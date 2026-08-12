import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import {
  handleReVerifyCron,
  runReVerification,
} from '../../src/server/reverify-cron'

// Reserved 99- GOC numbers map to deterministic mock outcomes:
//   99-000001 -> found-active (stays verified)
//   99-000002 -> not-found   (revoked)
//   99-000004 -> error       (indeterminate; untouched)
// Clean by GOC number, not just short_id: the reserved 99-000001/2/4 fixtures
// are shared with the checkout suites, which seed them under a different
// short_id/email. Clearing by goc_number removes any leftover from either
// suite so the insert below never collides on the unique constraint.
async function cleanup(): Promise<void> {
  await db.query(
    `delete from public.practitioners
      where short_id like 'rv-test-%'
         or goc_number in ('99-000001', '99-000002', '99-000004')`,
  )
  await db.query(
    "delete from public.verifications where goc_number like '99-%'",
  )
}

async function seedVisible(
  shortId: string,
  gocNumber: string,
  lastVerifiedDaysAgo: number,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id, visible, last_verified_at)
     values ($1, $2, $3, 'optician', $4,
        'verified', 'active', 'cus_rv_test', $5, true,
        now() - make_interval(days => $6))
     returning id`,
    [
      shortId,
      `RV ${shortId}`,
      gocNumber,
      `${shortId}@example.com`,
      `sub_rv_${shortId}`,
      lastVerifiedDaysAgo,
    ],
  )
  return result.rows[0].id
}

// Reserved 99- GOC numbers collide with the checkout suites; clean up after
// the file so no row outlives it (shared Compose DB, fileParallelism: false).
afterAll(cleanup)

describe('runReVerification', () => {
  beforeEach(cleanup)

  it('bumps last_verified_at for a still-active practitioner', async () => {
    const id = await seedVisible('rv-test-active', '99-000001', 30)

    const summary = await runReVerification()

    expect(summary.stillVerified).toBeGreaterThanOrEqual(1)
    const row = await db.query<{
      verification_status: string
      visible: boolean
      last_verified_at: Date
    }>(
      'select verification_status, visible, last_verified_at from public.practitioners where id = $1',
      [id],
    )
    expect(row.rows[0].verification_status).toBe('verified')
    expect(row.rows[0].visible).toBe(true)
    expect(row.rows[0].last_verified_at.getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    )
  })

  it('revokes, hides, cancels billing and records a refund for a struck-off practitioner', async () => {
    const id = await seedVisible('rv-test-struck', '99-000002', 1)

    const summary = await runReVerification()

    expect(summary.revoked).toBeGreaterThanOrEqual(1)
    const row = await db.query<{
      verification_status: string
      visible: boolean
      subscription_status: string
    }>(
      `select verification_status, visible, subscription_status
         from public.practitioners where id = $1`,
      [id],
    )
    expect(row.rows[0].verification_status).toBe('revoked')
    expect(row.rows[0].visible).toBe(false)
    expect(row.rows[0].subscription_status).toBe('canceled')

    const ledger = await db.query<{ outcome: string }>(
      'select outcome from public.revocation_refunds where practitioner_id = $1',
      [id],
    )
    expect(ledger.rows[0].outcome).toBe('refunded')
  })

  it('leaves a transient-error practitioner untouched', async () => {
    const id = await seedVisible('rv-test-error', '99-000004', 1)

    const summary = await runReVerification()

    expect(summary.indeterminate).toBeGreaterThanOrEqual(1)
    const row = await db.query<{
      verification_status: string
      visible: boolean
    }>(
      'select verification_status, visible from public.practitioners where id = $1',
      [id],
    )
    expect(row.rows[0].verification_status).toBe('verified')
    expect(row.rows[0].visible).toBe(true)
  })
})

describe('handleReVerifyCron auth', () => {
  beforeEach(cleanup)

  it('rejects a request without the bearer token', async () => {
    const response = await handleReVerifyCron(
      new Request('https://micare.co.uk/api/cron/re-verify'),
    )
    expect(response.status).toBe(401)
  })

  it('runs and returns a summary with the correct token', async () => {
    await seedVisible('rv-test-auth', '99-000001', 30)
    const response = await handleReVerifyCron(
      new Request('https://micare.co.uk/api/cron/re-verify', {
        headers: { authorization: 'Bearer integration-test-cron-secret' },
      }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { checked: number }
    expect(body.checked).toBeGreaterThanOrEqual(1)
  })
})
