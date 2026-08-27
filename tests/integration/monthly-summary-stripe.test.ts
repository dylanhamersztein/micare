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
import type { runMonthlySummaries as runFn } from '../../src/server/monthly-summary-cron'
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

let runMonthlySummaries: typeof runFn
let db: typeof dbApi
let stripeModule: typeof stripeModuleNs

const PRACTITIONER_EMAIL = 'ms-real@example.co.uk'
const NOW = new Date('2026-06-13T08:00:00.000Z')

// Deliberately anchored so the LOCAL created_at math would put the renewal in
// July: only a period read from Stripe makes this Practitioner due tomorrow.
const CREATED_AT = '2026-01-05T00:00:00.000Z'
const STRIPE_PERIOD_START = new Date('2026-05-20T12:00:00.000Z')
const STRIPE_PERIOD_END = new Date('2026-06-14T12:00:00.000Z')

beforeAll(async () => {
  runMonthlySummaries = (await import('../../src/server/monthly-summary-cron'))
    .runMonthlySummaries
  db = (await import('../../src/server/db')).db
  stripeModule = await import('../../src/server/stripe')
})

async function seedDue(): Promise<string> {
  await db.query('delete from public.practitioners where email = $1', [
    PRACTITIONER_EMAIL,
  ])
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id, created_at)
     values ('MSREAL01', 'Real Renewer', '99-000888', 'optician', $1,
        'verified', 'active', 'cus_ms_real', 'sub_ms_real', $2)
     returning id`,
    [PRACTITIONER_EMAIL, CREATED_AT],
  )
  return result.rows[0].id
}

function stubStripePeriod(): ReturnType<typeof vi.fn> {
  const retrieve = vi.fn().mockResolvedValue({
    id: 'sub_ms_real',
    items: {
      data: [
        {
          current_period_start: STRIPE_PERIOD_START.getTime() / 1000,
          current_period_end: STRIPE_PERIOD_END.getTime() / 1000,
        },
      ],
    },
  })
  vi.spyOn(stripeModule, 'getStripe').mockReturnValue({
    subscriptions: { retrieve },
  } as unknown as ReturnType<typeof stripeModule.getStripe>)
  return retrieve
}

beforeEach(seedDue)

afterEach(async () => {
  vi.restoreAllMocks()
  await db.query('delete from public.practitioners where email = $1', [
    PRACTITIONER_EMAIL,
  ])
})

describe('runMonthlySummaries (real Stripe + Resend boundary)', () => {
  it('takes the cycle window from Stripe and emails the count via Resend', async () => {
    const id = await seedDue()
    await db.query(
      `insert into public.clickthroughs (practitioner_id, hashed_visitor, occurred_at)
       values ($1, 'v1', '2026-05-19T10:00:00.000Z'),
              ($1, 'v2', '2026-05-21T10:00:00.000Z'),
              ($1, 'v3', '2026-06-10T10:00:00.000Z')`,
      [id],
    )
    const retrieve = stubStripePeriod()
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))

    const run = await runMonthlySummaries(NOW)

    expect(run.sent).toBe(1)
    expect(retrieve).toHaveBeenCalledWith('sub_ms_real')

    // Resend called at the HTTP boundary, addressed to the Practitioner, with
    // the count for Stripe's window (the 19 May click-through falls outside).
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const sent = JSON.parse((init as RequestInit).body as string) as {
      to: string
      subject: string
      text: string
    }
    expect(sent.to).toBe(PRACTITIONER_EMAIL)
    expect(sent.text).toContain('2 click-throughs')
  })
})
