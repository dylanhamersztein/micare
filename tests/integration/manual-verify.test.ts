import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { runManualVerification } from '../../src/server/manual-verify'

// Reserved 99- GOC numbers map to deterministic mock outcomes:
//   99-000001 -> found-active  99-000002 -> not-found
//   99-000003 -> ambiguous     99-000004 -> error
// They are shared with the checkout and re-verification suites, so clean by
// GOC number as well as short_id — a leftover row from either would collide
// on practitioners.goc_number.
const RESERVED = ['99-000001', '99-000002', '99-000003', '99-000004']

async function cleanup(): Promise<void> {
  await db.query(
    `delete from public.practitioners
      where short_id like 'mv-test-%' or goc_number = any($1)`,
    [RESERVED],
  )
  await db.query(
    'delete from public.verifications where goc_number = any($1)',
    [RESERVED],
  )
}

async function seedPending(
  shortId: string,
  gocNumber: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.practitioners
       (short_id, full_name, goc_number, profession_code, email,
        verification_status, subscription_status)
     values ($1, $2, $3, 'optician', $4, 'pending', 'incomplete')
     returning id`,
    [shortId, `MV ${shortId}`, gocNumber, `${shortId}@example.com`],
  )
  return rows[0].id
}

afterAll(cleanup)

describe('runManualVerification', () => {
  beforeEach(cleanup)

  it('flips a stuck-pending Practitioner to verified and records the attempt', async () => {
    const id = await seedPending('mv-test-active', '99-000001')

    const outcome = await runManualVerification({
      gocNumber: '99-000001',
      force: false,
    })

    expect(outcome).toMatchObject({
      kind: 'applied',
      practitionerId: id,
      previousStatus: 'pending',
      result: 'found-active',
      newStatus: 'verified',
    })

    const { rows } = await db.query<{
      verification_status: string
      last_verified_at: Date | null
    }>(
      `select verification_status, last_verified_at
         from public.practitioners where id = $1`,
      [id],
    )
    expect(rows[0].verification_status).toBe('verified')
    expect(rows[0].last_verified_at?.getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    )

    const attempts = await db.query<{ status: string }>(
      'select status from public.verifications where goc_number = $1',
      ['99-000001'],
    )
    expect(attempts.rows).toHaveLength(1)
    expect(attempts.rows[0].status).toBe('verified')
  })

  it('flips a Practitioner the register does not know to rejected', async () => {
    const id = await seedPending('mv-test-absent', '99-000002')

    const outcome = await runManualVerification({
      gocNumber: '99-000002',
      force: false,
    })

    expect(outcome).toMatchObject({
      result: 'not-found',
      newStatus: 'rejected',
    })

    // 'rejected' is itself what hides them: the visibility predicate lets
    // only 'verified' through (ADR-0024).
    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('rejected')
  })

  // A register that would not load says nothing about the Practitioner. The
  // row is left exactly as it was — including last_verified_at, which is what
  // the daily stale alert reads — so the operator can simply try again.
  it('leaves the row untouched when the register could not be read', async () => {
    const id = await seedPending('mv-test-error', '99-000004')

    const outcome = await runManualVerification({
      gocNumber: '99-000004',
      force: false,
    })

    expect(outcome).toMatchObject({ result: 'error', newStatus: 'pending' })

    const { rows } = await db.query<{
      verification_status: string
      last_verified_at: Date | null
    }>(
      `select verification_status, last_verified_at
         from public.practitioners where id = $1`,
      [id],
    )
    expect(rows[0].verification_status).toBe('pending')
    expect(rows[0].last_verified_at).toBeNull()
  })

  it('reports a GOC number no Practitioner holds', async () => {
    const outcome = await runManualVerification({
      gocNumber: '99-000001',
      force: false,
    })

    expect(outcome).toMatchObject({ kind: 'no-such-practitioner' })
    const attempts = await db.query(
      'select 1 from public.verifications where goc_number = $1',
      ['99-000001'],
    )
    expect(attempts.rows).toHaveLength(0)
  })

  // Recovery tooling, not a re-decision button: a `revoked` Practitioner is
  // revoked because the weekly cron found them struck off, and re-running the
  // register here must not quietly reinstate them.
  it('refuses a Practitioner who is not stuck in pending', async () => {
    const id = await seedPending('mv-test-revoked', '99-000001')
    await db.query(
      "update public.practitioners set verification_status = 'revoked' where id = $1",
      [id],
    )

    const outcome = await runManualVerification({
      gocNumber: '99-000001',
      force: false,
    })

    expect(outcome).toMatchObject({
      kind: 'not-pending',
      verificationStatus: 'revoked',
    })

    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('revoked')
    const attempts = await db.query(
      'select 1 from public.verifications where goc_number = $1',
      ['99-000001'],
    )
    expect(attempts.rows).toHaveLength(0)
  })
})

// The cached result deliberately contradicts what the register would say now
// (99-000001 mocks found-active), so "which answer won" is observable.
async function seedCachedNotFound(gocNumber: string): Promise<void> {
  await db.query(
    `insert into public.verifications (goc_number, status, result, scraped_at)
     values ($1, 'rejected', $2::jsonb, now() - interval '2 hours')`,
    [
      gocNumber,
      JSON.stringify({ kind: 'not-found', registrationNumber: gocNumber }),
    ],
  )
}

describe('runManualVerification and the 24h suppression cache', () => {
  beforeEach(cleanup)

  it('reuses a result scraped within the last 24 hours', async () => {
    const id = await seedPending('mv-test-cached', '99-000001')
    await seedCachedNotFound('99-000001')

    const outcome = await runManualVerification({
      gocNumber: '99-000001',
      force: false,
    })

    expect(outcome).toMatchObject({ result: 'not-found', forced: false })

    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('rejected')

    // No fresh attempt: the cached row is still the only one.
    const attempts = await db.query(
      'select 1 from public.verifications where goc_number = $1',
      ['99-000001'],
    )
    expect(attempts.rows).toHaveLength(1)
  })

  it('goes back to the register when the operator forces it', async () => {
    const id = await seedPending('mv-test-forced', '99-000001')
    await seedCachedNotFound('99-000001')

    const outcome = await runManualVerification({
      gocNumber: '99-000001',
      force: true,
    })

    expect(outcome).toMatchObject({ result: 'found-active', forced: true })

    const { rows } = await db.query<{ verification_status: string }>(
      'select verification_status from public.practitioners where id = $1',
      [id],
    )
    expect(rows[0].verification_status).toBe('verified')

    // The fresh attempt is appended, so the audit trail keeps both answers.
    const attempts = await db.query<{ status: string }>(
      `select status from public.verifications
        where goc_number = $1 order by scraped_at asc`,
      ['99-000001'],
    )
    expect(attempts.rows.map((r) => r.status)).toEqual(['rejected', 'verified'])
  })
})
