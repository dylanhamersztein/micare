// `visibility` deep module — the single source of truth for ADR-0002
// (verified-only) and ADR-0004 (subscription + dunning) visibility rules.
//
// A Practitioner is visible to consumers iff:
//   1. their Verification Status is `verified`, AND
//   2. their Stripe subscription is in an active dunning-tolerant state, AND
//   3. the minimum profile fields required for a useful listing are filled.

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'revoked'

export type SubscriptionStatus =
  | 'incomplete'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'canceled'

export type VisibilityInput = {
  verificationStatus: VerificationStatus
  subscriptionStatus: SubscriptionStatus
  minFieldsFilled: boolean
}

const VISIBLE_SUBSCRIPTION_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'active',
  'trialing',
  'past_due',
])

export function isVisible({
  verificationStatus,
  subscriptionStatus,
  minFieldsFilled,
}: VisibilityInput): boolean {
  if (verificationStatus !== 'verified') return false
  if (!VISIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) return false
  return minFieldsFilled
}
