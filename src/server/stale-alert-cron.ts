// Daily stale-verification alert (ADR-0007 / issue #13). Surfaces every
// visible Practitioner whose last_verified_at is older than
// STALE_VERIFICATION_DAYS (or never set) — a signal that the weekly cron or
// the GOC scraper is failing and trust is eroding. Delivery (log + email) is
// owned by alert-delivery.ts.
//
// "Visible" is the isVisible() predicate applied to live row state, never a
// stored flag (ADR-0024): the alert reports on exactly the Practitioners a
// consumer can reach, so ageing rows nobody can see raise no false alarm.

import { env } from '../env.server'
import type { StalePractitioner } from '../stale-alert'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { hasMinFields, isVisible } from '../visibility'
import { deliverStaleAlert } from './alert-delivery'
import { cronAuthError } from './cron-auth'
import { db } from './db'

type CandidateRow = StalePractitioner & {
  practice_name: string | null
  practice_address_line1: string | null
  practice_postcode: string | null
  booking_link_url: string | null
  verification_status: VerificationStatus
  subscription_status: SubscriptionStatus
}

export async function findStalePractitioners(
  thresholdDays: number,
): Promise<Array<StalePractitioner>> {
  const { rows } = await db.query<CandidateRow>(
    `select id, short_id, full_name, last_verified_at,
            practice_name, practice_address_line1, practice_postcode,
            booking_link_url, verification_status, subscription_status
       from public.practitioners
      where last_verified_at is null
         or last_verified_at < now() - make_interval(days => $1::int)
      order by last_verified_at asc nulls first`,
    [thresholdDays],
  )

  return rows
    .filter((row) =>
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
    .map((row) => ({
      id: row.id,
      short_id: row.short_id,
      full_name: row.full_name,
      last_verified_at: row.last_verified_at,
    }))
}

export async function handleStaleAlertCron(
  request: Request,
): Promise<Response> {
  const authError = cronAuthError(request, env.CRON_SECRET)
  if (authError) return authError

  const stale = await findStalePractitioners(env.STALE_VERIFICATION_DAYS)
  const { channel } = await deliverStaleAlert(stale)
  return Response.json({ staleCount: stale.length, channel })
}
