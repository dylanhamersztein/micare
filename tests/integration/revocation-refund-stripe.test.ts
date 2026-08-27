import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { db as dbApi } from '../../src/server/db'
import type { handleRevocationRefund as handleFn } from '../../src/server/revocation-refund-impl'
import type * as stripeModuleNs from '../../src/server/stripe'

// env.server.ts reads VITE_STRIPE_MOCK / ALERT_MOCK once at first import. Force
// the real paths before any dynamic import below.
process.env.VITE_STRIPE_MOCK = 'false'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
process.env.STRIPE_PRICE_ID = 'price_test_29gbp'
process.env.APP_URL = 'http://localhost:3000'
process.env.ALERT_MOCK = 'false'
process.env.OPERATOR_ALERT_EMAIL = 'ops@example.co.uk'
process.env.RESEND_API_KEY = 're_test_dummy'

let handleRevocationRefund: typeof handleFn
let db: typeof dbApi
let stripeModule: typeof stripeModuleNs

const PRACTITIONER_EMAIL = 'rr-real@example.co.uk'

// The revoked Practitioner is halfway through a £29 month: paid on 1 March,
// struck off on 16 March, so exactly half the payment is unused.
const PERIOD_START = Math.floor(Date.UTC(2026, 2, 1) / 1000)
const PERIOD_END = Math.floor(Date.UTC(2026, 2, 31) / 1000)
const REVOKED_AT = new Date(Date.UTC(2026, 2, 16))

beforeAll(async () => {
  handleRevocationRefund = (
    await import('../../src/server/revocation-refund-impl')
  ).handleRevocationRefund
  db = (await import('../../src/server/db')).db
  stripeModule = await import('../../src/server/stripe')
})

async function seedActive(): Promise<string> {
  await db.query('delete from public.practitioners where email = $1', [
    PRACTITIONER_EMAIL,
  ])
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id)
     values ('RRREAL01', 'Real Revoked', '99-000777', 'optician', $1,
        'revoked', 'active', 'cus_rr_real', 'sub_rr_real')
     returning id`,
    [PRACTITIONER_EMAIL],
  )
  return result.rows[0].id
}

/** One paid invoice for the March period, shaped as the Stripe API returns it. */
function paidInvoice(amountPaid: number) {
  return {
    id: 'in_rr_real',
    amount_paid: amountPaid,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    lines: { data: [{ period: { start: PERIOD_START, end: PERIOD_END } }] },
    payments: {
      data: [
        {
          status: 'paid',
          payment: { type: 'payment_intent', payment_intent: 'pi_rr_real' },
        },
      ],
    },
  }
}

type StripeStub = {
  cancel: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  createRefund: ReturnType<typeof vi.fn>
}

function stubStripe(invoices: Array<unknown>): StripeStub {
  const cancel = vi
    .fn()
    .mockResolvedValue({ id: 'sub_rr_real', status: 'canceled' })
  const list = vi.fn().mockResolvedValue({ data: invoices })
  const createRefund = vi.fn().mockResolvedValue({ id: 're_rr_real' })
  vi.spyOn(stripeModule, 'getStripe').mockReturnValue({
    subscriptions: { cancel },
    invoices: { list },
    refunds: { create: createRefund },
  } as unknown as ReturnType<typeof stripeModule.getStripe>)
  return { cancel, list, createRefund }
}

function stubResend() {
  return vi
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(null, { status: 200 }))
}

function sentEmail(fetchSpy: ReturnType<typeof stubResend>) {
  const [, init] = fetchSpy.mock.calls[0]
  return JSON.parse((init as RequestInit).body as string) as {
    to: string
    subject: string
    text: string
  }
}

async function ledgerRow(id: string) {
  const { rows } = await db.query<{
    outcome: string
    refunded_pence: number | null
  }>(
    'select outcome, refunded_pence from public.revocation_refunds where practitioner_id = $1',
    [id],
  )
  return rows[0]
}

beforeEach(async () => {
  await seedActive()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(REVOKED_AT)
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await db.query('delete from public.practitioners where email = $1', [
    PRACTITIONER_EMAIL,
  ])
})

describe('handleRevocationRefund (real Stripe + Resend boundary)', () => {
  it('refunds the unused portion of the last paid invoice to the card', async () => {
    const id = await seedActive()
    const stripe = stubStripe([paidInvoice(2900)])
    stubResend()

    const outcome = await handleRevocationRefund(id)

    expect(outcome).toEqual({ kind: 'refunded', pence: 1450 })
    expect(stripe.list).toHaveBeenCalledWith(
      expect.objectContaining({ subscription: 'sub_rr_real', status: 'paid' }),
    )
    expect(stripe.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_rr_real', amount: 1450 }),
    )
  })

  it('cancels without proration, so the refund is the only money movement', async () => {
    const id = await seedActive()
    const stripe = stubStripe([paidInvoice(2900)])
    stubResend()

    await handleRevocationRefund(id)

    expect(stripe.cancel).toHaveBeenCalledWith(
      'sub_rr_real',
      expect.objectContaining({ prorate: false }),
    )
  })

  it('tells the practitioner the amount that was actually refunded', async () => {
    const id = await seedActive()
    stubStripe([paidInvoice(2900)])
    const fetchSpy = stubResend()

    await handleRevocationRefund(id)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = sentEmail(fetchSpy)
    expect(body.to).toBe(PRACTITIONER_EMAIL)
    expect(body.subject).toBe('Your MiCare listing has been removed')
    expect(body.text).toContain('£14.50')
  })

  it('settles the ledger with the refunded amount', async () => {
    const id = await seedActive()
    stubStripe([paidInvoice(2900)])
    stubResend()

    await handleRevocationRefund(id)

    expect(await ledgerRow(id)).toEqual({
      outcome: 'refunded',
      refunded_pence: 1450,
    })
  })

  it('cancels but refunds nothing when the subscription has no paid invoice', async () => {
    const id = await seedActive()
    const stripe = stubStripe([])
    const fetchSpy = stubResend()

    const outcome = await handleRevocationRefund(id)

    expect(outcome).toEqual({ kind: 'nothing-to-refund' })
    expect(stripe.cancel).toHaveBeenCalledTimes(1)
    expect(stripe.createRefund).not.toHaveBeenCalled()
    expect(sentEmail(fetchSpy).text).toContain('nothing to refund')
    expect(await ledgerRow(id)).toEqual({
      outcome: 'nothing-to-refund',
      refunded_pence: null,
    })
  })

  it('refunds nothing when the paid period has already elapsed', async () => {
    const id = await seedActive()
    vi.setSystemTime(new Date(PERIOD_END * 1000))
    const stripe = stubStripe([paidInvoice(2900)])
    stubResend()

    const outcome = await handleRevocationRefund(id)

    expect(outcome).toEqual({ kind: 'nothing-to-refund' })
    expect(stripe.createRefund).not.toHaveBeenCalled()
  })

  it('leaves the ledger row pending when the refund fails, and stays idempotent', async () => {
    const id = await seedActive()
    const stripe = stubStripe([paidInvoice(2900)])
    stripe.createRefund.mockRejectedValue(new Error('card_error'))
    stubResend()

    await expect(handleRevocationRefund(id)).rejects.toThrow('card_error')
    expect(await ledgerRow(id)).toEqual({
      outcome: 'pending',
      refunded_pence: null,
    })

    const replay = await handleRevocationRefund(id)

    expect(replay).toEqual({ kind: 'duplicate' })
    expect(stripe.cancel).toHaveBeenCalledTimes(1)
  })
})
