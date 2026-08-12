// Resolves the billing period a Practitioner is currently inside. Stripe is
// the system of record for subscription state (ADR-0010), so the live path
// reads the period bounds off the subscription rather than recomputing them.
//
// Under VITE_STRIPE_MOCK there is no subscription to read, so the period is
// derived locally from created_at with the same math the dashboard uses
// (src/billing-cycle.ts) — which keeps the suite and local dev offline.

import { currentBillingCycle } from '../billing-cycle'
import type { BillingCycle } from '../billing-cycle'
import { env } from '../env.server'
import { getStripe } from './stripe'

export async function currentBillingPeriod(
  subscription: { stripeSubscriptionId: string | null; createdAt: Date },
  now: Date,
): Promise<BillingCycle> {
  if (env.VITE_STRIPE_MOCK || !subscription.stripeSubscriptionId) {
    return currentBillingCycle(subscription.createdAt, now)
  }

  const live = await getStripe().subscriptions.retrieve(
    subscription.stripeSubscriptionId,
  )
  // Since API version 2024-11-20 the period bounds live on the subscription
  // ITEM, not the subscription (MiCare pins 2026-04-22.dahlia). Phase 1 sells
  // exactly one £29 price, so the single item's period is the subscription's.
  const item = live.items.data.at(0)
  if (!item) {
    throw new Error(
      `currentBillingPeriod: subscription ${subscription.stripeSubscriptionId} has no items`,
    )
  }
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  }
}
