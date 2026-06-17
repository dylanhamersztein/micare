// Read model for /dashboard. Aggregates the six readouts the slice-10 issue
// lists, including the click-through count filtered to the current billing
// cycle (computed locally from created_at via src/billing-cycle.ts — no live
// Stripe call). `now` is injectable so integration tests are deterministic.

import { currentBillingCycle } from '../billing-cycle'
import { generateProfileUrl } from '../slug'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { db } from './db'
import { findPractitionerByEmail } from './practitioner-account'

export type DashboardData = {
  fullName: string
  verificationStatus: VerificationStatus
  lastVerifiedAt: string | null
  subscriptionStatus: SubscriptionStatus
  clickthroughCount: number
  cycleStart: string
  cycleEnd: string
  publicProfileUrl: string
}

export async function loadDashboardImpl(
  email: string,
  now: Date = new Date(),
): Promise<DashboardData | null> {
  const account = await findPractitionerByEmail(email)
  if (!account) return null

  const cycle = currentBillingCycle(account.createdAt, now)

  const countResult = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.clickthroughs
      where practitioner_id = $1
        and occurred_at >= $2
        and occurred_at < $3`,
    [account.id, cycle.start, cycle.end],
  )

  return {
    fullName: account.fullName,
    verificationStatus: account.verificationStatus,
    lastVerifiedAt: account.lastVerifiedAt?.toISOString() ?? null,
    subscriptionStatus: account.subscriptionStatus,
    clickthroughCount: countResult.rows[0]?.count ?? 0,
    cycleStart: cycle.start.toISOString(),
    cycleEnd: cycle.end.toISOString(),
    publicProfileUrl: generateProfileUrl({
      shortId: account.shortId,
      fullName: account.fullName,
      practiceName: account.practiceName,
      practiceTown: account.practiceTown,
    }),
  }
}
