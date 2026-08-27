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
//   99-000005 -> found-active under a fixed registrant name (name mismatch)
// Clean by GOC number, not just short_id: the reserved 99-000001/2/4 fixtures
// are shared with the checkout suites, which seed them under a different
// short_id/email. Clearing by goc_number removes any leftover from either
// suite so the insert below never collides on the unique constraint.
async function cleanup(): Promise<void> {
  await db.query(
    `delete from public.practitioners
      where short_id like 'rv-test-%'
         or goc_number in ('99-000001', '99-000002', '99-000004', '99-000005')`,
  )
  await db.query(
    "delete from public.verifications where goc_number like '99-%'",
  )
}

// Seeds a row the visibility predicate includes: verified, on a dunning-
// tolerant subscription, with every minimum profile field filled. The sweep
// population is defined by that predicate and nothing else — see ADR-0024.
async function seedVisible(
  shortId: string,
  gocNumber: string,
  lastVerifiedDaysAgo: number,
  overrides: { subscriptionStatus?: string; practiceName?: string | null } = {},
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        practice_name, practice_address_line1, practice_postcode,
        booking_link_url,
        verification_status, subscription_status, stripe_customer_id,
        stripe_subscription_id, last_verified_at)
     values ($1, $2, $3, 'optician', $4,
        $7, '1 Register Street', 'EC2V 6AA',
        'https://example.co.uk/book',
        'verified', $8, 'cus_rv_test', $5,
        now() - make_interval(days => $6))
     returning id`,
    [
      shortId,
      `RV ${shortId}`,
      gocNumber,
      `${shortId}@example.com`,
      `sub_rv_${shortId}`,
      lastVerifiedDaysAgo,
      overrides.practiceName === undefined
        ? `RV Practice ${shortId}`
        : overrides.practiceName,
      overrides.subscriptionStatus ?? 'active',
    ],
  )
  return result.rows[0].id
}

async function lastVerifiedAt(id: string): Promise<Date | null> {
  const { rows } = await db.query<{ last_verified_at: Date | null }>(
    'select last_verified_at from public.practitioners where id = $1',
    [id],
  )
  return rows[0].last_verified_at
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
      last_verified_at: Date
    }>(
      'select verification_status, last_verified_at from public.practitioners where id = $1',
      [id],
    )
    expect(row.rows[0].verification_status).toBe('verified')
    expect(row.rows[0].last_verified_at.getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    )
  })

  it('revokes, cancels billing and records a refund for a struck-off practitioner', async () => {
    const id = await seedVisible('rv-test-struck', '99-000002', 1)

    const summary = await runReVerification()

    expect(summary.revoked).toBeGreaterThanOrEqual(1)
    const row = await db.query<{
      verification_status: string
      subscription_status: string
    }>(
      `select verification_status, subscription_status
         from public.practitioners where id = $1`,
      [id],
    )
    expect(row.rows[0].verification_status).toBe('revoked')
    expect(row.rows[0].subscription_status).toBe('canceled')

    const ledger = await db.query<{ outcome: string }>(
      'select outcome from public.revocation_refunds where practitioner_id = $1',
      [id],
    )
    expect(ledger.rows[0].outcome).toBe('refunded')
  })

  // Issue #68: a name mismatch at re-verification is not evidence that the
  // Practitioner left the register — the number is still there and still
  // active. It usually means the name on the register changed. Revoking on it
  // would cancel a live subscription and refund a genuine registrant over a
  // marriage certificate, so the sweep leaves the row alone and lets it age
  // into the stale alert for a human to look at (ADR-0007).
  it('does not revoke a Practitioner whose register name no longer matches', async () => {
    const id = await seedVisible('rv-test-renamed', '99-000005', 1)
    const before = await lastVerifiedAt(id)

    await runReVerification()

    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('verified')
    // Not confirmed either: the sweep did not establish that this row is the
    // registrant, so it must not refresh the clock the stale alert reads.
    expect(await lastVerifiedAt(id)).toEqual(before)
  })

  it('leaves a transient-error practitioner untouched', async () => {
    const id = await seedVisible('rv-test-error', '99-000004', 1)

    const summary = await runReVerification()

    expect(summary.indeterminate).toBeGreaterThanOrEqual(1)
    const row = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(row.rows[0].verification_status).toBe('verified')
  })

  // The sweep exists to keep ADR-0002's invariant true for the profiles a
  // consumer can actually reach. A Practitioner the predicate excludes is
  // not listed, so re-checking them against the register is wasted scraping.
  it('skips a practitioner whose subscription has been canceled', async () => {
    const id = await seedVisible('rv-test-canceled', '99-000001', 30, {
      subscriptionStatus: 'canceled',
    })
    const before = await lastVerifiedAt(id)

    await runReVerification()

    expect((await lastVerifiedAt(id))?.getTime()).toBe(before?.getTime())
  })

  it('skips a practitioner whose profile is missing the minimum fields', async () => {
    const id = await seedVisible('rv-test-incomplete', '99-000001', 30, {
      practiceName: null,
    })
    const before = await lastVerifiedAt(id)

    await runReVerification()

    expect((await lastVerifiedAt(id))?.getTime()).toBe(before?.getTime())
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
