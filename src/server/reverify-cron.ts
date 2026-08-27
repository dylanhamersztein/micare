// Weekly re-verification cron (ADR-0007 / issue #13). Iterates every visible
// Practitioner, re-runs the verification deep module, and applies the row
// transition itself. verify() owns the verifications-table write and the 24h
// suppression cache; this module only updates the practitioners row.
//
// "Visible" is the isVisible() predicate applied to live row state, never a
// stored flag (ADR-0024) — the sweep and the consumer surfaces therefore
// cover exactly the same Practitioners.
//
//   found-active -> still active: bump last_verified_at.
//   not-found    -> struck off:   verification_status = 'revoked', which is
//                                  itself what hides them. The status flip +
//                                  the verifications row is the signal the
//                                  refund-on-revocation slice consumes (no
//                                  new event bus).
//   error/ambiguous -> transient: leave the row alone. The un-bumped
//                                  last_verified_at ages it into the daily
//                                  stale alert; we never hide a legitimate
//                                  practitioner over a scraper hiccup.

import { env } from '../env.server'
import type { ProfessionCode } from '../verification'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { hasMinFields, isVisible } from '../visibility'
import { cronAuthError } from './cron-auth'
import { db } from './db'
import { handleRevocationRefund } from './revocation-refund-impl'
import { verify } from './verification-impl'

export type ReVerificationSummary = {
  checked: number
  stillVerified: number
  revoked: number
  indeterminate: number
}

type CandidateRow = {
  id: string
  goc_number: string
  full_name: string
  profession_code: string
  practice_name: string | null
  practice_address_line1: string | null
  practice_postcode: string | null
  booking_link_url: string | null
  verification_status: VerificationStatus
  subscription_status: SubscriptionStatus
}

export async function runReVerification(): Promise<ReVerificationSummary> {
  const { rows } = await db.query<CandidateRow>(
    `select id, goc_number, full_name, profession_code,
            practice_name, practice_address_line1, practice_postcode,
            booking_link_url, verification_status, subscription_status
       from public.practitioners`,
  )
  const visible = rows.filter((row) =>
    isVisible({
      verificationStatus: row.verification_status,
      subscriptionStatus: row.subscription_status,
      minFieldsFilled: hasMinFields({
        fullName: row.full_name,
        practiceName: row.practice_name,
        practiceAddressLine1: row.practice_address_line1,
        practicePostcode: row.practice_postcode,
        bookingLinkUrl: row.booking_link_url,
      }),
    }),
  )

  const summary: ReVerificationSummary = {
    checked: 0,
    stillVerified: 0,
    revoked: 0,
    indeterminate: 0,
  }

  for (const p of visible) {
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
                updated_at = now()
          where id = $1`,
        [p.id],
      )
      summary.revoked++
      // Cancel billing + notify. Isolated so one failed refund cannot abort
      // the weekly sweep; the handler is idempotent, so a future manual replay
      // is safe. Errors surface in the structured log for operator recovery.
      try {
        await handleRevocationRefund(p.id)
      } catch (error) {
        console.error('[cron:re-verify] revocation refund failed', p.id, error)
      }
    } else {
      // error | ambiguous | name-mismatch — leave untouched. The first two are
      // a register we could not read; the third is a register that still holds
      // this number under a name that has moved (issue #68). None of them is
      // evidence the Practitioner left the register, and revoking cancels a
      // subscription and issues a refund, so all three age into the stale
      // alert for a human instead.
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
