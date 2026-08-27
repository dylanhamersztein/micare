import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { handleRevocationRefund } from '../../src/server/revocation-refund-impl'

// Default env (VITE_STRIPE_MOCK=true, ALERT_MOCK=true): no Stripe call, no
// Resend fetch — the mock path, where the unused portion is derived from the
// local billing cycle rather than a Stripe invoice (ADR-0029). Real-boundary
// assertions live in revocation-refund-stripe.test.ts. Deleting the
// practitioner cascades the revocation_refunds row (FK ON DELETE CASCADE), so
// no separate ledger cleanup is needed.
async function cleanup(): Promise<void> {
  await db.query(
    "delete from public.practitioners where short_id like 'rr-test-%'",
  )
}

async function seed(args: {
  shortId: string
  subscriptionStatus: string
  stripeSubscriptionId: string | null
}): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id)
     values ($1, $2, $3, 'optician', $4,
        'revoked', $5, 'cus_rr_test', $6)
     returning id`,
    [
      args.shortId,
      `RR ${args.shortId}`,
      `99-${args.shortId}`,
      `${args.shortId}@example.com`,
      args.subscriptionStatus,
      args.stripeSubscriptionId,
    ],
  )
  return result.rows[0].id
}

async function ledgerRow(id: string) {
  const { rows } = await db.query<{
    outcome: string
    refunded_pence: number | null
  }>(
    `select outcome, refunded_pence from public.revocation_refunds
      where practitioner_id = $1`,
    [id],
  )
  return rows[0]
}

afterAll(cleanup)

describe('handleRevocationRefund (mock path)', () => {
  beforeEach(cleanup)

  it('cancels an active subscription and flips status to canceled', async () => {
    const id = await seed({
      shortId: 'rr-test-active',
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_rr_active',
    })

    const outcome = await handleRevocationRefund(id)

    expect(outcome.kind).toBe('refunded')
    const row = await db.query<{ subscription_status: string }>(
      'select subscription_status from public.practitioners where id = $1',
      [id],
    )
    expect(row.rows[0].subscription_status).toBe('canceled')
  })

  it('settles the ledger with the amount it refunded, not with its intent', async () => {
    const id = await seed({
      shortId: 'rr-test-settle',
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_rr_settle',
    })

    const outcome = await handleRevocationRefund(id)

    // Revoked the instant the cycle began, so nearly the whole £29 is unused.
    expect(outcome).toEqual({
      kind: 'refunded',
      pence: expect.any(Number) as number,
    })
    const settled = await ledgerRow(id)
    expect(settled.outcome).toBe('refunded')
    expect(settled.refunded_pence).toBe(
      outcome.kind === 'refunded' ? outcome.pence : null,
    )
    expect(settled.refunded_pence).toBeGreaterThan(0)
  })

  it('takes the no-Stripe path for an already-terminal subscription', async () => {
    const id = await seed({
      shortId: 'rr-test-terminal',
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: 'sub_rr_terminal',
    })

    const outcome = await handleRevocationRefund(id)

    expect(outcome).toEqual({ kind: 'already-terminal' })
    expect(await ledgerRow(id)).toEqual({
      outcome: 'already-terminal',
      refunded_pence: null,
    })
  })

  it('treats a missing stripe_subscription_id as already-terminal', async () => {
    const id = await seed({
      shortId: 'rr-test-nosub',
      subscriptionStatus: 'incomplete',
      stripeSubscriptionId: null,
    })

    const outcome = await handleRevocationRefund(id)

    expect(outcome).toEqual({ kind: 'already-terminal' })
  })

  it('is idempotent: a replay is a no-op and leaves one ledger row', async () => {
    const id = await seed({
      shortId: 'rr-test-replay',
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_rr_replay',
    })

    const first = await handleRevocationRefund(id)
    const firstUpdatedAt = await db.query<{ updated_at: Date }>(
      'select updated_at from public.practitioners where id = $1',
      [id],
    )

    const second = await handleRevocationRefund(id)
    const secondUpdatedAt = await db.query<{ updated_at: Date }>(
      'select updated_at from public.practitioners where id = $1',
      [id],
    )
    const ledger = await db.query<{ count: string }>(
      'select count(*) as count from public.revocation_refunds where practitioner_id = $1',
      [id],
    )

    expect(first.kind).toBe('refunded')
    expect(second).toEqual({ kind: 'duplicate' })
    expect(Number(ledger.rows[0].count)).toBe(1)
    expect(secondUpdatedAt.rows[0].updated_at.getTime()).toBe(
      firstUpdatedAt.rows[0].updated_at.getTime(),
    )
  })
})
