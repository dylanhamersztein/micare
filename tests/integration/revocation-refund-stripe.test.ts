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

beforeEach(seedActive)

afterEach(async () => {
  vi.restoreAllMocks()
  await db.query('delete from public.practitioners where email = $1', [
    PRACTITIONER_EMAIL,
  ])
})

describe('handleRevocationRefund (real Stripe + Resend boundary)', () => {
  it('cancels the subscription with proration and emails the practitioner', async () => {
    const id = await seedActive()

    const cancel = vi
      .fn()
      .mockResolvedValue({ id: 'sub_rr_real', status: 'canceled' })
    vi.spyOn(stripeModule, 'getStripe').mockReturnValue({
      subscriptions: { cancel },
    } as unknown as ReturnType<typeof stripeModule.getStripe>)

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))

    const outcome = await handleRevocationRefund(id)

    expect(outcome).toEqual({ kind: 'refunded' })

    // Stripe cancel called with proration at the boundary.
    expect(cancel).toHaveBeenCalledWith(
      'sub_rr_real',
      expect.objectContaining({ prorate: true, invoice_now: true }),
    )

    // Resend called at the HTTP boundary, addressed to the practitioner.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const sentBody = JSON.parse((init as RequestInit).body as string) as {
      to: string
      subject: string
    }
    expect(sentBody.to).toBe(PRACTITIONER_EMAIL)
    expect(sentBody.subject).toBe('Your MiCare listing has been removed')
  })
})
