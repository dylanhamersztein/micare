// Read model for /dashboard. Aggregates the six readouts the slice-10 issue
// lists, including the click-through count filtered to the current billing
// cycle. The cycle comes from `currentBillingPeriod` — the same reader the
// monthly summary email uses — so Stripe owns the bounds (ADR-0011) and the
// two never disagree about which window a count covers. `now` is injectable
// so integration tests are deterministic.

import { generateProfileUrl } from '../slug'
import type { SubscriptionStatus, VerificationStatus } from '../visibility'
import { currentBillingPeriod } from './billing-period'
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

  const cycle = await currentBillingPeriod(
    {
      stripeSubscriptionId: account.stripeSubscriptionId,
      createdAt: account.createdAt,
    },
    now,
  )

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
