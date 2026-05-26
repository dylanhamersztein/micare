import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

// env.server.ts reads VITE_STRIPE_MOCK once at first import. Force the real
// path before any dynamic import below.
process.env.VITE_STRIPE_MOCK = 'false'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_for_signing'
process.env.STRIPE_PRICE_ID = 'price_test_29gbp'
process.env.APP_URL = 'http://localhost:3000'

import type Stripe from 'stripe'
import type { handleStripeWebhook as handleFn } from '../../src/server/webhook-handler'
import type { db as dbApi } from '../../src/server/db'

let handleStripeWebhook: typeof handleFn
let db: typeof dbApi
let getStripe: typeof import('../../src/server/stripe').getStripe

const CUSTOMER_ID = 'cus_webhook_test'
const SUBSCRIPTION_ID = 'sub_webhook_test'
const TEST_EMAIL = 'webhook@example.co.uk'

function signedRequest(payload: object): Request {
  const body = JSON.stringify(payload)
  const stripe = getStripe()
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  })
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': header,
      'content-type': 'application/json',
    },
    body,
  })
}

function subscriptionCreatedEvent(): object {
  return {
    id: 'evt_test_sub_created',
    object: 'event',
    type: 'customer.subscription.created',
    data: {
      object: {
        id: SUBSCRIPTION_ID,
        customer: CUSTOMER_ID,
        status: 'active',
      } as Partial<Stripe.Subscription>,
    },
  }
}

async function seedPractitionerInIncomplete(): Promise<void> {
  await db.query('delete from public.practitioners where email = $1', [
    TEST_EMAIL,
  ])
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       verification_status, subscription_status, stripe_customer_id
     ) values (
       $1, 'Webhook Optician', $2, 'optician', $3,
       'verified', 'incomplete', $4
     )`,
    ['WEBHK001', '99-000099', TEST_EMAIL, CUSTOMER_ID],
  )
}

beforeAll(async () => {
  handleStripeWebhook = (await import('../../src/server/webhook-handler'))
    .handleStripeWebhook
  db = (await import('../../src/server/db')).db
  getStripe = (await import('../../src/server/stripe')).getStripe
})

beforeEach(async () => {
  await db.query(
    "delete from public.stripe_events where event_id like 'evt_test_%'",
  )
  await seedPractitionerInIncomplete()
})

afterEach(async () => {
  await db.query(
    "delete from public.stripe_events where event_id like 'evt_test_%'",
  )
  await db.query('delete from public.practitioners where email = $1', [
    TEST_EMAIL,
  ])
})

describe('handleStripeWebhook', () => {
  it('returns 400 when the signature header is missing', async () => {
    const body = JSON.stringify(subscriptionCreatedEvent())
    const request = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })

    const response = await handleStripeWebhook(request)

    expect(response.status).toBe(400)
  })

  it('returns 400 when the signature does not match the body', async () => {
    const body = JSON.stringify(subscriptionCreatedEvent())
    const request = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'stripe-signature': 't=1234,v1=deadbeef',
        'content-type': 'application/json',
      },
      body,
    })

    const response = await handleStripeWebhook(request)

    expect(response.status).toBe(400)
  })

  it('on customer.subscription.created with status=active, flips the practitioner row to active and records the event', async () => {
    const response = await handleStripeWebhook(
      signedRequest(subscriptionCreatedEvent()),
    )

    expect(response.status).toBe(200)
    const row = await db.query<{
      subscription_status: string
      stripe_subscription_id: string | null
    }>(
      `select subscription_status, stripe_subscription_id
         from public.practitioners where stripe_customer_id = $1`,
      [CUSTOMER_ID],
    )
    expect(row.rows[0].subscription_status).toBe('active')
    expect(row.rows[0].stripe_subscription_id).toBe(SUBSCRIPTION_ID)

    const ledger = await db.query(
      'select 1 from public.stripe_events where event_id = $1',
      ['evt_test_sub_created'],
    )
    expect(ledger.rowCount).toBe(1)
  })

  it('is idempotent: a replay of the same event leaves the row unchanged and writes no new ledger row', async () => {
    await handleStripeWebhook(signedRequest(subscriptionCreatedEvent()))
    const firstRow = await db.query<{
      updated_at: Date
      subscription_status: string
    }>(
      `select updated_at, subscription_status
         from public.practitioners where stripe_customer_id = $1`,
      [CUSTOMER_ID],
    )

    await handleStripeWebhook(signedRequest(subscriptionCreatedEvent()))
    const secondRow = await db.query<{
      updated_at: Date
      subscription_status: string
    }>(
      `select updated_at, subscription_status
         from public.practitioners where stripe_customer_id = $1`,
      [CUSTOMER_ID],
    )
    const ledger = await db.query<{ count: string }>(
      'select count(*) as count from public.stripe_events where event_id = $1',
      ['evt_test_sub_created'],
    )

    expect(secondRow.rows[0].subscription_status).toBe('active')
    expect(secondRow.rows[0].updated_at.getTime()).toBe(
      firstRow.rows[0].updated_at.getTime(),
    )
    expect(Number(ledger.rows[0].count)).toBe(1)
  })

  it('returns 200 and writes no practitioner change for an unhandled event type', async () => {
    const otherEvent = {
      id: 'evt_test_other',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: CUSTOMER_ID } },
    }

    const response = await handleStripeWebhook(signedRequest(otherEvent))

    expect(response.status).toBe(200)
    const row = await db.query<{ subscription_status: string }>(
      `select subscription_status from public.practitioners where stripe_customer_id = $1`,
      [CUSTOMER_ID],
    )
    expect(row.rows[0].subscription_status).toBe('incomplete')
  })
})
