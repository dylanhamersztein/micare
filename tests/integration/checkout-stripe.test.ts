import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// env.server.ts reads VITE_STRIPE_MOCK once at first import. Force the real
// path before any dynamic import below.
process.env.VITE_STRIPE_MOCK = 'false'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
process.env.STRIPE_PRICE_ID = 'price_test_29gbp'
process.env.APP_URL = 'http://localhost:3000'

import type { db as dbApi } from '../../src/server/db'
import type { startCheckoutImpl as startCheckoutImplFn } from '../../src/server/checkout-impl'
import type Stripe from 'stripe'

let startCheckoutImpl: typeof startCheckoutImplFn
let db: typeof dbApi
let stripeModule: typeof import('../../src/server/stripe')

const STRIPE_GOC_NUMBER = '99-000001'
const STRIPE_EMAIL = 'real-checkout@example.co.uk'

beforeAll(async () => {
  startCheckoutImpl = (await import('../../src/server/checkout-impl')).startCheckoutImpl
  db = (await import('../../src/server/db')).db
  stripeModule = await import('../../src/server/stripe')
})

beforeEach(async () => {
  await db.query("delete from public.verifications where goc_number like '99-%'")
  await db.query("delete from public.practitioners where email like '%@example.co.uk'")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('startCheckoutImpl (real Stripe path)', () => {
  it('creates a Stripe Customer and Checkout Session, persists stripe_customer_id, leaves subscription_status incomplete', async () => {
    const fakeCustomer = { id: 'cus_test_real' } as Stripe.Customer
    const fakeSession = {
      id: 'cs_test_real',
      url: 'https://checkout.stripe.test/cs_test_real',
    } as Stripe.Checkout.Session
    const customersCreate = vi.fn().mockResolvedValue(fakeCustomer)
    const sessionsCreate = vi.fn().mockResolvedValue(fakeSession)
    vi.spyOn(stripeModule, 'getStripe').mockReturnValue({
      customers: { create: customersCreate },
      checkout: { sessions: { create: sessionsCreate } },
    } as unknown as ReturnType<typeof stripeModule.getStripe>)

    const result = await startCheckoutImpl({
      fullName: 'Real Optician',
      professionCode: 'optician',
      gocNumber: STRIPE_GOC_NUMBER,
      email: STRIPE_EMAIL,
    })

    expect(result.kind).toBe('stripe')
    if (result.kind !== 'stripe') throw new Error('expected stripe result')
    expect(result.checkoutUrl).toBe('https://checkout.stripe.test/cs_test_real')
    expect(customersCreate).toHaveBeenCalledWith({
      email: STRIPE_EMAIL,
      name: 'Real Optician',
      metadata: { goc_number: STRIPE_GOC_NUMBER },
    })
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_test_real',
        line_items: [{ price: 'price_test_29gbp', quantity: 1 }],
        success_url:
          'http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/checkout/cancel',
      }),
    )

    const row = await db.query<{
      subscription_status: string
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
    }>(
      `select subscription_status, stripe_customer_id, stripe_subscription_id
         from public.practitioners where email = $1`,
      [STRIPE_EMAIL],
    )
    expect(row.rows[0].subscription_status).toBe('incomplete')
    expect(row.rows[0].stripe_customer_id).toBe('cus_test_real')
    expect(row.rows[0].stripe_subscription_id).toBeNull()
  })
})
