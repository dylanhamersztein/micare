import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import {
  handleMonthlySummaryCron,
  runMonthlySummaries,
} from '../../src/server/monthly-summary-cron'

// Default env (VITE_STRIPE_MOCK=true, ALERT_MOCK=true): billing periods are
// derived locally from created_at and no Resend fetch happens. The real
// Stripe + Resend boundaries are asserted in monthly-summary-stripe.test.ts.
//
// Every practitioner here is anchored at 2026-05-14T09:30Z, so the cycle
// containing NOW runs 14 May -> 14 June and renews the day after NOW.
const ANCHOR = '2026-05-14T09:30:00.000Z'
const NOW = new Date('2026-06-13T08:00:00.000Z')
const PERIOD_END = new Date('2026-06-14T09:30:00.000Z')

async function cleanup(): Promise<void> {
  await db.query(
    "delete from public.practitioners where short_id like 'ms-test-%'",
  )
}

async function seed(args: {
  shortId: string
  subscriptionStatus?: string
  createdAt?: string
}): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id, visible, created_at)
     values ($1, $2, $3, 'optician', $4,
        'verified', $5, 'cus_ms_test', $6, true, $7)
     returning id`,
    [
      args.shortId,
      `MS ${args.shortId}`,
      `99-${args.shortId}`,
      `${args.shortId}@example.com`,
      args.subscriptionStatus ?? 'active',
      `sub_${args.shortId}`,
      args.createdAt ?? ANCHOR,
    ],
  )
  return result.rows[0].id
}

async function seedClickthroughs(
  practitionerId: string,
  occurredAt: Array<string>,
): Promise<void> {
  for (const [index, at] of occurredAt.entries()) {
    await db.query(
      `insert into public.clickthroughs (practitioner_id, hashed_visitor, occurred_at)
       values ($1, $2, $3)`,
      [practitionerId, `visitor-${index}-${at}`, at],
    )
  }
}

afterAll(cleanup)

describe('runMonthlySummaries (mock path)', () => {
  beforeEach(cleanup)

  it('sends a summary to a practitioner renewing tomorrow, counting the cycle', async () => {
    const id = await seed({ shortId: 'ms-test-due' })
    await seedClickthroughs(id, [
      '2026-05-20T10:00:00.000Z',
      '2026-06-01T10:00:00.000Z',
      '2026-06-12T10:00:00.000Z',
    ])

    const summary = await runMonthlySummaries(NOW)

    expect(summary.sent).toBe(1)
    const ledger = await db.query<{
      clickthrough_count: number
      period_end: Date
    }>(
      `select clickthrough_count, period_end
         from public.monthly_summaries
        where practitioner_id = $1`,
      [id],
    )
    expect(ledger.rows[0].clickthrough_count).toBe(3)
    expect(ledger.rows[0].period_end.getTime()).toBe(PERIOD_END.getTime())
  })

  it('counts only click-throughs inside the cycle window', async () => {
    const id = await seed({ shortId: 'ms-test-window' })
    await seedClickthroughs(id, [
      '2026-05-14T09:29:59.000Z', // previous cycle, one second early
      '2026-05-14T09:30:00.000Z', // first instant of this cycle
      '2026-06-12T10:00:00.000Z', // inside
      '2026-06-14T09:30:00.000Z', // next cycle, the renewal instant itself
    ])

    await runMonthlySummaries(NOW)

    const ledger = await db.query<{ clickthrough_count: number }>(
      'select clickthrough_count from public.monthly_summaries where practitioner_id = $1',
      [id],
    )
    expect(ledger.rows[0].clickthrough_count).toBe(2)
  })

  it('is idempotent: a second run for the same cycle sends nothing', async () => {
    const id = await seed({ shortId: 'ms-test-replay' })
    await seedClickthroughs(id, ['2026-06-01T10:00:00.000Z'])

    const first = await runMonthlySummaries(NOW)
    const second = await runMonthlySummaries(NOW)

    expect(first.sent).toBe(1)
    expect(second.sent).toBe(0)
    const ledger = await db.query<{ count: string }>(
      'select count(*) as count from public.monthly_summaries where practitioner_id = $1',
      [id],
    )
    expect(Number(ledger.rows[0].count)).toBe(1)
  })

  it('sends again next cycle — the ledger is keyed per renewal', async () => {
    const id = await seed({ shortId: 'ms-test-nextcycle' })

    const june = await runMonthlySummaries(NOW)
    const july = await runMonthlySummaries(new Date('2026-07-13T08:00:00.000Z'))

    expect(june.sent).toBe(1)
    expect(july.sent).toBe(1)
    const ledger = await db.query<{ period_end: Date }>(
      `select period_end from public.monthly_summaries
        where practitioner_id = $1 order by period_end`,
      [id],
    )
    expect(ledger.rows.map((r) => r.period_end.toISOString())).toEqual([
      '2026-06-14T09:30:00.000Z',
      '2026-07-14T09:30:00.000Z',
    ])
  })

  it('emails only Practitioners with a live subscription', async () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      await seed({
        shortId: `ms-test-live-${status}`,
        subscriptionStatus: status,
      })
    }
    for (const status of ['canceled', 'unpaid', 'incomplete']) {
      await seed({
        shortId: `ms-test-dead-${status}`,
        subscriptionStatus: status,
      })
    }

    const run = await runMonthlySummaries(NOW)

    expect(run.sent).toBe(3)
    const recipients = await db.query<{ short_id: string }>(
      `select p.short_id from public.monthly_summaries m
         join public.practitioners p on p.id = m.practitioner_id
        where p.short_id like 'ms-test-%' order by p.short_id`,
    )
    expect(recipients.rows.map((r) => r.short_id)).toEqual([
      'ms-test-live-active',
      'ms-test-live-past_due',
      'ms-test-live-trialing',
    ])
  })

  it('skips a Practitioner whose renewal is not tomorrow', async () => {
    await seed({ shortId: 'ms-test-midcycle' })

    const run = await runMonthlySummaries(new Date('2026-06-01T08:00:00.000Z'))

    expect(run.sent).toBe(0)
  })
})

describe('handleMonthlySummaryCron auth', () => {
  beforeEach(cleanup)

  it('rejects a request without the bearer token', async () => {
    const response = await handleMonthlySummaryCron(
      new Request('https://micare.co.uk/api/cron/monthly-summary'),
    )
    expect(response.status).toBe(401)
  })

  it('runs and returns a summary with the correct token', async () => {
    const response = await handleMonthlySummaryCron(
      new Request('https://micare.co.uk/api/cron/monthly-summary', {
        headers: { authorization: 'Bearer integration-test-cron-secret' },
      }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { candidates: number; sent: number }
    expect(body).toHaveProperty('sent')
  })
})
