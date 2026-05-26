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

  it('returns null for unhandled event types', () => {
    const event = {
      id: 'evt_test_other',
      type: 'customer.created',
      data: { object: { id: 'cus_other' } as unknown as Stripe.Customer },
    } as Stripe.Event

    expect(mapStripeEvent(event)).toBeNull()
  })
})
