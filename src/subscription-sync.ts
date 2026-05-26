// `subscription-sync` deep module (pure half). Maps a Stripe Event to the
// state change that should be applied to the Practitioner row, or null when
// the event is one we don't act on. No IO, no SDK calls, no env reads — only
// structural narrowing over the event payload. The webhook handler at
// /api/stripe/webhook calls this; integration tests exercise it via the
// handler. Slice 7 implements the first cut: customer.subscription.created
// with status=active, and invoice.payment_succeeded for a subscription
// invoice. ADR-0004's full lifecycle (past_due / unpaid / canceled) is a
// downstream slice — each new case here is a switch-case addition, not an
// architectural change.

import type Stripe from 'stripe'

import type { SubscriptionStatus } from './visibility'

export type SubscriptionStateChange = {
  stripeCustomerId: string
  stripeSubscriptionId: string
  subscriptionStatus: SubscriptionStatus
}

// Stripe's `customer` and `subscription` fields on event objects are typed
// as `string | Stripe.Customer | null` etc. We pre-expanded nothing on the
// webhook side, so in practice they are bare strings — but we narrow safely
// so a stray expansion never crashes the mapper.
function asId(field: unknown): string | null {
  if (typeof field === 'string') return field
  if (field && typeof field === 'object' && 'id' in field) {
    const id = (field as { id: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

export function mapStripeEvent(
  event: Stripe.Event,
): SubscriptionStateChange | null {
  switch (event.type) {
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription
      if (sub.status !== 'active') return null
      const customer = asId(sub.customer)
      if (!customer) return null
      return {
        stripeCustomerId: customer,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: 'active',
      }
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null
      }
      const customer = asId(invoice.customer)
      const subscription = asId(invoice.subscription)
      if (!customer || !subscription) return null
      return {
        stripeCustomerId: customer,
        stripeSubscriptionId: subscription,
        subscriptionStatus: 'active',
      }
    }
    default:
      return null
  }
}
