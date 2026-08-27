// Server-only implementation of the `signup` orchestrator. Runs the
// verification deep module for one prospect, reports the coarse outcome the
// /signup panel branches on, and — when the register could not be read —
// files the prospect as a `pending` Practitioner. Integration tests call
// submitSignupImpl directly; src/server/signup.ts wraps it in a thin
// createServerFn shim.

import type { SignupInput } from '../signup-input'
import { generateShortId } from '../slug'
import { verificationOutcome } from '../verification'
import type { VerificationOutcome } from '../verification'
import { db } from './db'
import { linkVerificationsToPractitioner, verify } from './verification-impl'

const MAX_SHORT_ID_ATTEMPTS = 5

async function findPractitionerIdByGocNumber(
  gocNumber: string,
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    'select id from public.practitioners where goc_number = $1 limit 1',
    [gocNumber],
  )
  return rows.at(0)?.id ?? null
}

async function emailIsTaken(email: string): Promise<boolean> {
  const { rows } = await db.query(
    'select 1 from public.practitioners where lower(email) = lower($1) limit 1',
    [email],
  )
  return rows.length > 0
}

async function insertPendingPractitioner(data: SignupInput): Promise<string> {
  for (let attempt = 1; attempt <= MAX_SHORT_ID_ATTEMPTS; attempt++) {
    const shortId = generateShortId()
    try {
      const { rows } = await db.query<{ id: string }>(
        `insert into public.practitioners (
           short_id, full_name, goc_number, profession_code, email,
           verification_status, subscription_status
         ) values ($1, $2, $3, $4, $5, 'pending', 'incomplete')
         returning id`,
        [
          shortId,
          data.fullName,
          data.gocNumber,
          data.professionCode,
          data.email,
        ],
      )
      return rows[0].id
    } catch (error) {
      // 23505 = unique_violation. Retry on short_id collisions only.
      const code = (error as { code?: string }).code
      const detail = (error as { detail?: string }).detail ?? ''
      if (code === '23505' && detail.includes('short_id')) continue
      throw error
    }
  }
  throw new Error('Failed to allocate a unique short_id after retries')
}

// The prospect the register could not answer for. Filed as a `pending`
// Practitioner with no Stripe customer so Manual Re-verification has a row to
// act on (ADR-0014) and the operator has an email to follow up.
//
// Idempotent, and never writes over an account that already exists. A retry
// finds the row it filed last time and re-links nothing. An email that
// belongs to someone else is not this prospect's account, so nothing is filed
// and nothing is linked to it — the attempt still lands in `verifications`.
async function fileProspectAsPending(data: SignupInput): Promise<void> {
  const existingId = await findPractitionerIdByGocNumber(data.gocNumber)
  if (existingId) {
    await linkVerificationsToPractitioner(data.gocNumber, existingId)
    return
  }
  if (await emailIsTaken(data.email)) return

  const practitionerId = await insertPendingPractitioner(data)
  await linkVerificationsToPractitioner(data.gocNumber, practitionerId)
}

export async function submitSignupImpl(
  data: SignupInput,
): Promise<{ outcome: VerificationOutcome }> {
  const result = await verify(
    data.professionCode,
    data.fullName,
    data.gocNumber,
  )
  const outcome = verificationOutcome(result)

  if (outcome === 'pending') {
    await fileProspectAsPending(data)
  }

  return { outcome }
}
