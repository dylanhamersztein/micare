import type Stripe from 'stripe'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { searchPractitioners as searchFn } from '../../src/server/search-impl'

import type { handleStripeWebhook as handleFn } from '../../src/server/webhook-handler'
import type { db as dbApi } from '../../src/server/db'
import type { getStripe as getStripeFn } from '../../src/server/stripe'

// env.server.ts reads VITE_STRIPE_MOCK once at first import. Force the real
// path before any dynamic import below.
process.env.VITE_STRIPE_MOCK = 'false'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_for_signing'
process.env.STRIPE_PRICE_ID = 'price_test_29gbp'
process.env.APP_URL = 'http://localhost:3000'

let handleStripeWebhook: typeof handleFn
let db: typeof dbApi
let getStripe: typeof getStripeFn
let searchPractitioners: typeof searchFn

const CUSTOMER_ID = 'cus_webhook_test'
const SUBSCRIPTION_ID = 'sub_webhook_test'
const TEST_EMAIL = 'webhook@example.co.uk'

// EC2V 6AA — the same London point the search fixtures use.
const LONDON = {
  postcode: 'EC2V 6AA',
  longitude: -0.0921,
  latitude: 51.5144,
}

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

// Seeded verified and profile-complete at a known point so the ADR-0004
// visibility consequences of each lifecycle transition can be asserted
// through `/search` rather than by re-reading the rule in the test.
function subscriptionUpdatedEvent(overrides: {
  id?: string
  status: Stripe.Subscription.Status
  cancelAtPeriodEnd?: boolean
}): object {
  return {
    id: overrides.id ?? 'evt_test_sub_updated',
    object: 'event',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: SUBSCRIPTION_ID,
        customer: CUSTOMER_ID,
        status: overrides.status,
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
      } as Partial<Stripe.Subscription>,
    },
  }
}

function subscriptionDeletedEvent(): object {
  return {
    id: 'evt_test_sub_deleted',
    object: 'event',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: SUBSCRIPTION_ID,
        customer: CUSTOMER_ID,
        status: 'canceled',
        cancel_at_period_end: true,
      } as Partial<Stripe.Subscription>,
    },
  }
}

function invoicePaymentFailedEvent(): object {
  return {
    id: 'evt_test_invoice_failed',
    object: 'event',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_failed',
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
      } as Partial<Stripe.Invoice>,
    },
  }
}

async function seedPractitioner(
  subscriptionStatus = 'incomplete',
): Promise<void> {
  await db.query('delete from public.practitioners where email = $1', [
    TEST_EMAIL,
  ])
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       practice_name, practice_address_line1, practice_postcode,
       practice_town, practice_point, booking_link_url, bio,
       verification_status, subscription_status, stripe_customer_id
     ) values (
       $1, 'Webhook Optician', $2, 'optician', $3,
       'Webhook Eyecare', '1 Webhook Street', $4,
       'London',
       extensions.st_setsrid(extensions.st_makepoint($5, $6), 4326)::extensions.geography,
       'https://webhook-eyecare.example.co.uk/book',
       'Twenty years on the high street.',
       'verified', $7, $8
     )`,
    [
      'WEBHK001',
      '99-000099',
      TEST_EMAIL,
      LONDON.postcode,
      LONDON.longitude,
      LONDON.latitude,
      subscriptionStatus,
      CUSTOMER_ID,
    ],
  )
}

async function appearsInSearch(): Promise<boolean> {
  vi.stubGlobal('fetch', vi.fn())
  try {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 200, result: LONDON }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const results = await searchPractitioners({
      postcodeOrCity: LONDON.postcode,
      radiusMiles: 5,
    })
    return results.some((r) => r.shortId === 'WEBHK001')
  } finally {
    vi.unstubAllGlobals()
  }
}

async function practitionerRow(): Promise<{
  id: string
  subscription_status: string
  full_name: string
  bio: string | null
  booking_link_url: string | null
  practice_name: string | null
}> {
  const result = await db.query<{
    id: string
    subscription_status: string
    full_name: string
    bio: string | null
    booking_link_url: string | null
    practice_name: string | null
  }>(
    `select id, subscription_status, full_name, bio, booking_link_url, practice_name
       from public.practitioners where stripe_customer_id = $1`,
    [CUSTOMER_ID],
  )
  return result.rows[0]
}

beforeAll(async () => {
  handleStripeWebhook = (await import('../../src/server/webhook-handler'))
    .handleStripeWebhook
  db = (await import('../../src/server/db')).db
  getStripe = (await import('../../src/server/stripe')).getStripe
  searchPractitioners = (await import('../../src/server/search-impl'))
    .searchPractitioners
})

beforeEach(async () => {
  await db.query(
    "delete from public.stripe_events where event_id like 'evt_test_%'",
  )
  await seedPractitioner()
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

  it('on invoice.payment_failed, moves the practitioner to past_due but keeps them in search results (ADR-0004 dunning window)', async () => {
    await seedPractitioner('active')

    const response = await handleStripeWebhook(
      signedRequest(invoicePaymentFailedEvent()),
    )

    expect(response.status).toBe(200)
    expect((await practitionerRow()).subscription_status).toBe('past_due')
    expect(await appearsInSearch()).toBe(true)
  })

  it('on customer.subscription.updated to unpaid, hides the practitioner but preserves the row and every profile field', async () => {
    await seedPractitioner('past_due')
    const before = await practitionerRow()

    await handleStripeWebhook(
      signedRequest(subscriptionUpdatedEvent({ status: 'unpaid' })),
    )

    const after = await practitionerRow()
    expect(after.subscription_status).toBe('unpaid')
    expect(await appearsInSearch()).toBe(false)
    expect(after.id).toBe(before.id)
    expect(after.full_name).toBe(before.full_name)
    expect(after.bio).toBe(before.bio)
    expect(after.practice_name).toBe(before.practice_name)
    expect(after.booking_link_url).toBe(before.booking_link_url)
  })

  it('restores the same listing when an unpaid practitioner re-subscribes — no profile rebuild', async () => {
    await seedPractitioner('active')
    const before = await practitionerRow()

    await handleStripeWebhook(
      signedRequest(subscriptionUpdatedEvent({ status: 'unpaid' })),
    )
    expect(await appearsInSearch()).toBe(false)

    await handleStripeWebhook(signedRequest(subscriptionCreatedEvent()))

    const after = await practitionerRow()
    expect(after.subscription_status).toBe('active')
    expect(await appearsInSearch()).toBe(true)
    expect(after.id).toBe(before.id)
    expect(after.bio).toBe(before.bio)
    expect(after.booking_link_url).toBe(before.booking_link_url)
  })

  it('keeps a cancel-at-period-end practitioner listed until the period ends, then hides them on customer.subscription.deleted', async () => {
    await seedPractitioner('active')

    // Stripe reports the subscription as still active while the cancellation
    // is merely scheduled — the paid-for period is honoured.
    await handleStripeWebhook(
      signedRequest(
        subscriptionUpdatedEvent({ status: 'active', cancelAtPeriodEnd: true }),
      ),
    )
    expect((await practitionerRow()).subscription_status).toBe('active')
    expect(await appearsInSearch()).toBe(true)

    // The period ends and Stripe deletes the subscription.
    await handleStripeWebhook(signedRequest(subscriptionDeletedEvent()))
    const after = await practitionerRow()
    expect(after.subscription_status).toBe('canceled')
    expect(await appearsInSearch()).toBe(false)
    expect(after.booking_link_url).not.toBeNull()
  })

  it('is idempotent across the whole lifecycle: replaying each event yields the same state and one ledger row', async () => {
    await seedPractitioner('active')

    const lifecycle: Array<{ event: object; expected: string }> = [
      { event: invoicePaymentFailedEvent(), expected: 'past_due' },
      {
        event: subscriptionUpdatedEvent({ status: 'unpaid' }),
        expected: 'unpaid',
      },
      { event: subscriptionCreatedEvent(), expected: 'active' },
      { event: subscriptionDeletedEvent(), expected: 'canceled' },
    ]

    for (const { event, expected } of lifecycle) {
      const first = await handleStripeWebhook(signedRequest(event))
      const afterFirst = await practitionerRow()
      const replay = await handleStripeWebhook(signedRequest(event))
      const afterReplay = await practitionerRow()

      expect(first.status).toBe(200)
      expect(replay.status).toBe(200)
      expect(afterFirst.subscription_status).toBe(expected)
      expect(afterReplay.subscription_status).toBe(expected)

      const ledger = await db.query<{ count: string }>(
        'select count(*) as count from public.stripe_events where event_id = $1',
        [(event as { id: string }).id],
      )
      expect(Number(ledger.rows[0].count)).toBe(1)
    }
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
