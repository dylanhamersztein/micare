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
import type { loadDashboardImpl as loadFn } from '../../src/server/dashboard-impl'
import type * as stripeModuleNs from '../../src/server/stripe'

// env.server.ts reads VITE_STRIPE_MOCK once at first import. Force the real
// path before any dynamic import below.
process.env.VITE_STRIPE_MOCK = 'false'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
process.env.STRIPE_PRICE_ID = 'price_test_29gbp'
process.env.APP_URL = 'http://localhost:3000'

let loadDashboardImpl: typeof loadFn
let db: typeof dbApi
let stripeModule: typeof stripeModuleNs

const EMAIL = 'dash-real@example.co.uk'
const NOW = new Date('2026-06-10T08:00:00.000Z')

// Deliberately anchored so the LOCAL created_at math would give a window of
// [2026-06-05, 2026-07-05): only a period read from Stripe produces the
// bounds asserted below.
const CREATED_AT = '2026-01-05T00:00:00.000Z'
const STRIPE_PERIOD_START = new Date('2026-05-20T12:00:00.000Z')
const STRIPE_PERIOD_END = new Date('2026-06-20T12:00:00.000Z')

beforeAll(async () => {
  loadDashboardImpl = (await import('../../src/server/dashboard-impl'))
    .loadDashboardImpl
  db = (await import('../../src/server/db')).db
  stripeModule = await import('../../src/server/stripe')
})

async function clearTestRows(): Promise<void> {
  await db.query(
    `delete from public.clickthroughs where practitioner_id in
       (select id from public.practitioners where email = $1)`,
    [EMAIL],
  )
  await db.query('delete from public.practitioners where email = $1', [EMAIL])
}

async function seed(): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        practice_name, practice_town,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id, created_at)
     values ('DASHREAL', 'Real Renewer', '99-000889', 'optician', $1,
        'Board Optical', 'Bristol',
        'verified', 'active', 'cus_dash_real', 'sub_dash_real', $2)
     returning id`,
    [EMAIL, CREATED_AT],
  )
  return result.rows[0].id
}

function stubStripePeriod(): ReturnType<typeof vi.fn> {
  const retrieve = vi.fn().mockResolvedValue({
    id: 'sub_dash_real',
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

beforeEach(async () => {
  await clearTestRows()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await clearTestRows()
})

describe('loadDashboardImpl (real Stripe boundary)', () => {
  it('reports the cycle Stripe owns, not local created_at math', async () => {
    const id = await seed()
    await db.query(
      `insert into public.clickthroughs (practitioner_id, hashed_visitor, occurred_at)
       values ($1, 'v1', '2026-05-19T10:00:00.000Z'),
              ($1, 'v2', '2026-05-21T10:00:00.000Z'),
              ($1, 'v3', '2026-06-08T10:00:00.000Z')`,
      [id],
    )
    const retrieve = stubStripePeriod()

    const data = await loadDashboardImpl(EMAIL, NOW)

    expect(retrieve).toHaveBeenCalledWith('sub_dash_real')
    expect(data).not.toBeNull()
    expect(data!.cycleStart).toBe(STRIPE_PERIOD_START.toISOString())
    expect(data!.cycleEnd).toBe(STRIPE_PERIOD_END.toISOString())
    // The 19 May click-through falls outside Stripe's window.
    expect(data!.clickthroughCount).toBe(2)
  })
})
