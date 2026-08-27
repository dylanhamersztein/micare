// Pure proration math for the refund a struck-off Practitioner is owed
// (story 38 / ADR-0004). Given what they paid for a billing period and how
// much of that period is left when their registration is revoked, returns the
// unused portion in whole pence. No IO — the Stripe calls live in
// src/server/revocation-refund-impl.ts.
//
// Rounds DOWN: a fraction of a penny stays with MiCare rather than being
// invented for the refund, so the refund can never exceed what was paid.

import type { BillingCycle } from './billing-cycle'

export function unusedPortionPence(args: {
  amountPaidPence: number
  period: BillingCycle
  now: Date
}): number {
  const total = args.period.end.getTime() - args.period.start.getTime()
  if (total <= 0) return 0

  const remaining = args.period.end.getTime() - args.now.getTime()
  if (remaining <= 0) return 0

  const unused = Math.min(remaining, total) / total
  return Math.floor(args.amountPaidPence * unused)
}
