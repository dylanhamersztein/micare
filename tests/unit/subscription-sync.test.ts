import type Stripe from 'stripe'
import { describe, expect, it } from 'vitest'

import { mapStripeEvent } from '../../src/subscription-sync'

function subscriptionCreatedEvent(overrides: {
  customer: string
  subscription: string
  status: Stripe.Subscription.Status
}): Stripe.Event {
  return {
    id: 'evt_test_subscription_created',
    type: 'customer.subscription.created',
    data: {
      object: {
        id: overrides.subscription,
        customer: overrides.customer,
        status: overrides.status,
      } as unknown as Stripe.Subscription,
    },
  } as Stripe.Event
}

function invoicePaymentSucceededEvent(overrides: {
  customer: string
  subscription: string
}): Stripe.Event {
  return {
    id: 'evt_test_invoice_payment_succeeded',
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: 'in_test',
        customer: overrides.customer,
        subscription: overrides.subscription,
      } as unknown as Stripe.Invoice,
    },
  } as Stripe.Event
}

function subscriptionUpdatedEvent(overrides: {
  customer: string
  subscription: string
  status: Stripe.Subscription.Status
  cancelAtPeriodEnd?: boolean
}): Stripe.Event {
  return {
    id: 'evt_test_subscription_updated',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: overrides.subscription,
        customer: overrides.customer,
        status: overrides.status,
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
      } as unknown as Stripe.Subscription,
    },
  } as Stripe.Event
}

function invoicePaymentFailedEvent(overrides: {
  customer: string
  subscription: string | null
}): Stripe.Event {
  return {
    id: 'evt_test_invoice_payment_failed',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_failed',
        customer: overrides.customer,
        subscription: overrides.subscription,
      } as unknown as Stripe.Invoice,
    },
  } as Stripe.Event
}

describe('mapStripeEvent', () => {
  it('maps customer.subscription.created with status=active to an active state change', () => {
    const event = subscriptionCreatedEvent({
      customer: 'cus_123',
      subscription: 'sub_123',
      status: 'active',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'active',
    })
  })

  it('returns null for customer.subscription.created in a non-active status (out of scope for slice 7)', () => {
    const event = subscriptionCreatedEvent({
      customer: 'cus_123',
      subscription: 'sub_123',
      status: 'incomplete',
    })

    expect(mapStripeEvent(event)).toBeNull()
  })

  it('maps invoice.payment_succeeded to an active state change', () => {
    const event = invoicePaymentSucceededEvent({
      customer: 'cus_456',
      subscription: 'sub_456',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_456',
      stripeSubscriptionId: 'sub_456',
      subscriptionStatus: 'active',
    })
  })

  it('returns null for invoice.payment_succeeded with no subscription (one-off invoice)', () => {
    const event = {
      id: 'evt_test_oneoff',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_oneoff',
          customer: 'cus_789',
          subscription: null,
        } as unknown as Stripe.Invoice,
      },
    } as Stripe.Event

    expect(mapStripeEvent(event)).toBeNull()
  })

  it('maps invoice.payment_failed on a subscription invoice to past_due', () => {
    const event = invoicePaymentFailedEvent({
      customer: 'cus_dunning',
      subscription: 'sub_dunning',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_dunning',
      stripeSubscriptionId: 'sub_dunning',
      subscriptionStatus: 'past_due',
    })
  })

  it('returns null for invoice.payment_failed with no subscription (one-off invoice)', () => {
    const event = invoicePaymentFailedEvent({
      customer: 'cus_dunning',
      subscription: null,
    })

    expect(mapStripeEvent(event)).toBeNull()
  })

  it('maps customer.subscription.updated with status=past_due to past_due', () => {
    const event = subscriptionUpdatedEvent({
      customer: 'cus_upd',
      subscription: 'sub_upd',
      status: 'past_due',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_upd',
      stripeSubscriptionId: 'sub_upd',
      subscriptionStatus: 'past_due',
    })
  })

  it('maps customer.subscription.updated with status=unpaid to unpaid', () => {
    const event = subscriptionUpdatedEvent({
      customer: 'cus_upd',
      subscription: 'sub_upd',
      status: 'unpaid',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_upd',
      stripeSubscriptionId: 'sub_upd',
      subscriptionStatus: 'unpaid',
    })
  })

  it('maps customer.subscription.updated with status=canceled to canceled', () => {
    const event = subscriptionUpdatedEvent({
      customer: 'cus_upd',
      subscription: 'sub_upd',
      status: 'canceled',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_upd',
      stripeSubscriptionId: 'sub_upd',
      subscriptionStatus: 'canceled',
    })
  })

  it('keeps a cancel-at-period-end subscription active — Stripe reports status=active until the period actually ends', () => {
    const event = subscriptionUpdatedEvent({
      customer: 'cus_upd',
      subscription: 'sub_upd',
      status: 'active',
      cancelAtPeriodEnd: true,
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_upd',
      stripeSubscriptionId: 'sub_upd',
      subscriptionStatus: 'active',
    })
  })

  it('maps customer.subscription.updated with status=trialing to trialing', () => {
    const event = subscriptionUpdatedEvent({
      customer: 'cus_upd',
      subscription: 'sub_upd',
      status: 'trialing',
    })

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_upd',
      stripeSubscriptionId: 'sub_upd',
      subscriptionStatus: 'trialing',
    })
  })

  it('returns null for a Stripe status MiCare does not model, leaving the row untouched', () => {
    const event = subscriptionUpdatedEvent({
      customer: 'cus_upd',
      subscription: 'sub_upd',
      status: 'incomplete_expired',
    })

    expect(mapStripeEvent(event)).toBeNull()
  })

  it('maps customer.subscription.deleted to canceled — the end of a period-end cancellation', () => {
    const event = {
      id: 'evt_test_subscription_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_gone',
          customer: 'cus_gone',
          status: 'canceled',
          cancel_at_period_end: true,
        } as unknown as Stripe.Subscription,
      },
    } as Stripe.Event

    expect(mapStripeEvent(event)).toEqual({
      stripeCustomerId: 'cus_gone',
      stripeSubscriptionId: 'sub_gone',
      subscriptionStatus: 'canceled',
    })
  })

  it('returns null for unhandled event types', () => {
    const event = {
      id: 'evt_test_other',
      type: 'customer.created',
      data: { object: { id: 'cus_other' } as unknown as Stripe.Customer },
    } as Stripe.Event

    expect(mapStripeEvent(event)).toBeNull()
  })
})
