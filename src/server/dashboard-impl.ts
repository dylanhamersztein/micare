// Read model for /dashboard. Aggregates the six readouts the slice-10 issue
// lists, including the click-through count filtered to the current billing
// cycle (computed locally from created_at via src/billing-cycle.ts — no live
// Stripe call). `now` is injectable so integration tests are deterministic.

import { currentBillingCycle } from '../billing-cycle'
import { generateProfileUrl } from '../slug'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { countClickthroughs } from './clickthrough-count'
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

  const clickthroughCount = await countClickthroughs(account.id, cycle)

  return {
    fullName: account.fullName,
    verificationStatus: account.verificationStatus,
    lastVerifiedAt: account.lastVerifiedAt?.toISOString() ?? null,
    subscriptionStatus: account.subscriptionStatus,
    clickthroughCount,
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
