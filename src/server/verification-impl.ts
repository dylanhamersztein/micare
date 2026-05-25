// Server-only implementation of the `verification` deep module. `verify` is
// the public entry point: the signup orchestrator calls it, and (in a future
// slice) so will the weekly re-verification cron. It hides the GOC register
// scrape, the GOC_MOCK toggle, network retries inside a 10s budget, and the
// 24h re-scrape suppression cache backed by the append-only `verifications`
// table. Integration tests call `verify` directly; src/server/signup.ts wraps
// it in a thin createServerFn shim.

import { env } from '../env.server'
import { parseGocRegisterPage } from '../goc-register'
import { mockVerify, verificationOutcome } from '../verification'
import type { ProfessionCode, VerificationResult } from '../verification'
import { db } from './db'

const VERIFY_BUDGET_MS = 10_000
const MAX_ATTEMPTS = 3
const GOC_REGISTER_SEARCH_URL = 'https://str.optical.org/sectors/search'

// The 24h re-scrape suppression cache. Returns the most recent verification
// recorded for this GOC number within the last 24 hours, or null if there is
// none — in which case the caller performs a fresh attempt.
async function findCachedVerification(
  regNumber: string,
): Promise<VerificationResult | null> {
  const result = await db.query<{ result: VerificationResult }>(
    `select result
       from public.verifications
       where goc_number = $1
         and scraped_at > now() - interval '24 hours'
       order by scraped_at desc
       limit 1`,
    [regNumber],
  )
  return result.rows.at(0)?.result ?? null
}

// Appends one row to `verifications` for a real attempt. Cache hits never
// call this — a row is written once per actual scrape/mock, not per call.
async function recordVerification(input: {
  profession: ProfessionCode
  fullName: string
  regNumber: string
  result: VerificationResult
  rawHtml: string | null
}): Promise<void> {
  const snapshot = {
    submittedName: input.fullName,
    profession: input.profession,
    source: env.GOC_MOCK ? 'mock' : 'goc-register',
    rawHtml: input.rawHtml,
  }
  await db.query(
    `insert into public.verifications
       (practitioner_id, goc_number, status, result, raw_register_snapshot, evidence_url)
     values (null, $1, $2, $3::jsonb, $4::jsonb, $5)`,
    [
      input.regNumber,
      verificationOutcome(input.result),
      JSON.stringify(input.result),
      JSON.stringify(snapshot),
      env.GOC_MOCK ? null : GOC_REGISTER_SEARCH_URL,
    ],
  )
}

// Scrapes the GOC public register for one registration number. Every retry
// shares a single 10s deadline via one AbortController; a timeout or an
// exhausted retry budget resolves to an `error` result (never throws) so the
// signup flow can show the reassuring "system issue" message (user story 19).
async function scrapeGocRegister(
  regNumber: string,
): Promise<{ result: VerificationResult; rawHtml: string | null }> {
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), VERIFY_BUDGET_MS)
  const url = `${GOC_REGISTER_SEARCH_URL}?registrant_number=${encodeURIComponent(regNumber)}`

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { accept: 'text/html' },
        })
        if (!response.ok) {
          throw new Error(`GOC register HTTP ${response.status}`)
        }
        const html = await response.text()
        return { result: parseGocRegisterPage(html, regNumber), rawHtml: html }
      } catch (error) {
        if (controller.signal.aborted) {
          return {
            result: {
              kind: 'error',
              registrationNumber: regNumber,
              reason: 'GOC register lookup timed out',
            },
            rawHtml: null,
          }
        }
        if (attempt === MAX_ATTEMPTS) {
          return {
            result: {
              kind: 'error',
              registrationNumber: regNumber,
              reason: (error as Error).message,
            },
            rawHtml: null,
          }
        }
        // Fall through to the next attempt. The AbortController bounds total
        // wall-clock time, so retries cannot exceed the 10s budget.
      }
    }
    return {
      result: {
        kind: 'error',
        registrationNumber: regNumber,
        reason: 'GOC register retries exhausted',
      },
      rawHtml: null,
    }
  } finally {
    clearTimeout(deadline)
  }
}

export async function verify(
  profession: ProfessionCode,
  fullName: string,
  regNumber: string,
): Promise<VerificationResult> {
  const cached = await findCachedVerification(regNumber)
  if (cached) {
    return cached
  }

  const performed = env.GOC_MOCK
    ? { result: mockVerify(regNumber), rawHtml: null }
    : await scrapeGocRegister(regNumber)

  await recordVerification({
    profession,
    fullName,
    regNumber,
    result: performed.result,
    rawHtml: performed.rawHtml,
  })

  return performed.result
}
