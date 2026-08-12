// `subscription-sync` deep module (pure half). Maps a Stripe Event to the
// state change that should be applied to the Practitioner row, or null when
// the event is one we don't act on. No IO, no SDK calls, no env reads — only
// structural narrowing over the event payload. The webhook handler at
// /api/stripe/webhook calls this; integration tests exercise it via the
// handler.
//
// This is the whole ADR-0004 lifecycle for Phase 1:
//
//   customer.subscription.created (active)   -> active     (visible)
//   customer.subscription.updated            -> mirrors Stripe's status
//   customer.subscription.deleted            -> canceled   (hidden)
//   invoice.payment_succeeded (subscription) -> active      (visible)
//   invoice.payment_failed    (subscription) -> past_due    (still visible)
//
// `past_due` stays visible on purpose: Smart Retries runs a ~3-week dunning
// window and a failed card is usually a card problem, not a Practitioner
// leaving. A cancellation scheduled at period end needs no special case —
// Stripe keeps reporting `active` until the period actually ends and only
// then fires `customer.subscription.deleted`, so the paid-for period stays
// listed by construction. Nothing here deletes profile data; `unpaid` and
// `canceled` only hide, so resubscribing restores the same listing.

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
    const id = field.id
    return typeof id === 'string' ? id : null
  }
  return null
}

// Stripe subscription statuses that MiCare mirrors verbatim into
// `subscription_status`. Every other Stripe status (`incomplete_expired`,
// `paused`) has no MiCare meaning, so the row is left alone rather than
// forced into a state ADR-0004's visibility rules never anticipated.
const MIRRORED_STATUSES = new Set<string>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
])

function isMirroredStatus(
  status: Stripe.Subscription.Status,
): status is SubscriptionStatus & Stripe.Subscription.Status {
  return MIRRORED_STATUSES.has(status)
}

function fromSubscription(
  subscription: Stripe.Subscription,
  subscriptionStatus: SubscriptionStatus,
): SubscriptionStateChange | null {
  const customer = asId(subscription.customer)
  if (!customer) return null
  return {
    stripeCustomerId: customer,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus,
  }
}

// A subscription invoice carries the subscription id; a one-off invoice does
// not, and must never move a Practitioner's subscription state.
function fromInvoice(
  invoice: Stripe.Invoice,
  subscriptionStatus: SubscriptionStatus,
): SubscriptionStateChange | null {
  const { subscription: subscriptionField } = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const customer = asId(invoice.customer)
  const subscription = asId(subscriptionField)
  if (!customer || !subscription) return null
  return {
    stripeCustomerId: customer,
    stripeSubscriptionId: subscription,
    subscriptionStatus,
  }
}

export function mapStripeEvent(
  event: Stripe.Event,
): SubscriptionStateChange | null {
  switch (event.type) {
    case 'customer.subscription.created': {
      const subscription = event.data.object
      if (subscription.status !== 'active') return null
      return fromSubscription(subscription, 'active')
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object
      if (!isMirroredStatus(subscription.status)) return null
      return fromSubscription(subscription, subscription.status)
    }
    // Stripe fires this when the subscription actually ends — immediately on
    // an instant cancellation, or at period end when the Practitioner asked
    // to cancel at period end.
    case 'customer.subscription.deleted':
      return fromSubscription(event.data.object, 'canceled')
    case 'invoice.payment_succeeded':
      return fromInvoice(event.data.object, 'active')
    case 'invoice.payment_failed':
      return fromInvoice(event.data.object, 'past_due')
    default:
      return null
  }
}
