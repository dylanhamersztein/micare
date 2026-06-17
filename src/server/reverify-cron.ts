// Weekly re-verification cron (ADR-0007 / issue #13). Iterates every visible
// Practitioner, re-runs the verification deep module, and applies the row
// transition itself. verify() owns the verifications-table write and the 24h
// suppression cache; this module only updates the practitioners row.
//
//   found-active -> still active: bump last_verified_at.
//   not-found    -> struck off:   verification_status = 'revoked', visible =
//                                  false. The status flip + the verifications
//                                  row is the signal the refund-on-revocation
//                                  slice consumes (no new event bus).
//   error/ambiguous -> transient: leave the row alone. The un-bumped
//                                  last_verified_at ages it into the daily
//                                  stale alert; we never hide a legitimate
//                                  practitioner over a scraper hiccup.

import { env } from '../env.server'
import type { ProfessionCode } from '../verification'
import { cronAuthError } from './cron-auth'
import { db } from './db'
import { verify } from './verification-impl'

export type ReVerificationSummary = {
  checked: number
  stillVerified: number
  revoked: number
  indeterminate: number
}

type VisibleRow = {
  id: string
  goc_number: string
  full_name: string
  profession_code: string
}

export async function runReVerification(): Promise<ReVerificationSummary> {
  const { rows } = await db.query<VisibleRow>(
    `select id, goc_number, full_name, profession_code
       from public.practitioners
      where visible = true`,
  )

  const summary: ReVerificationSummary = {
    checked: 0,
    stillVerified: 0,
    revoked: 0,
    indeterminate: 0,
  }

  for (const p of rows) {
    summary.checked++
    const result = await verify(
      p.profession_code as ProfessionCode,
      p.full_name,
      p.goc_number,
    )

    if (result.kind === 'found-active') {
      await db.query(
        `update public.practitioners
            set last_verified_at = now(), updated_at = now()
          where id = $1`,
        [p.id],
      )
      summary.stillVerified++
    } else if (result.kind === 'not-found') {
      await db.query(
        `update public.practitioners
            set verification_status = 'revoked',
                visible = false,
                updated_at = now()
          where id = $1`,
        [p.id],
      )
      summary.revoked++
    } else {
      // error | ambiguous — leave untouched.
      summary.indeterminate++
    }
  }

  return summary
}

export async function handleReVerifyCron(request: Request): Promise<Response> {
  const authError = cronAuthError(request, env.CRON_SECRET)
  if (authError) return authError

  const summary = await runReVerification()
  // Structured per-run summary — the audit trail in Vercel logs.
  console.log('[cron:re-verify]', JSON.stringify(summary))
  return Response.json(summary)
}
