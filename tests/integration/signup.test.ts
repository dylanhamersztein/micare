import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { runManualVerification } from '../../src/server/manual-verify'
import { submitSignupImpl } from '../../src/server/signup-impl'

// Reserved 99- GOC numbers map to deterministic mock outcomes:
//   99-000001 -> found-active  99-000002 -> not-found
//   99-000003 -> ambiguous     99-000004 -> error
// Shared with the checkout, verification and manual-verify suites, so clean
// by GOC number: a leftover row from any of them collides on goc_number.
const VERIFIED = '99-000001'
const REJECTED = '99-000002'
const AMBIGUOUS = '99-000003'
const UNREACHABLE = '99-000004'
const RESERVED = [VERIFIED, REJECTED, AMBIGUOUS, UNREACHABLE]

function prospect(gocNumber: string) {
  return {
    fullName: 'Pending Prospect',
    professionCode: 'optician' as const,
    gocNumber,
    email: `signup-${gocNumber}@example.co.uk`,
  }
}

type PractitionerRow = {
  full_name: string
  email: string
  verification_status: string
  subscription_status: string
  stripe_customer_id: string | null
  last_verified_at: Date | null
}

async function verificationRowCount(gocNumber: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    'select count(*) as count from public.verifications where goc_number = $1',
    [gocNumber],
  )
  return Number(rows[0].count)
}

async function practitionerRows(gocNumber: string) {
  const { rows } = await db.query<PractitionerRow>(
    `select full_name, email, verification_status, subscription_status,
            stripe_customer_id, last_verified_at
       from public.practitioners
      where goc_number = $1`,
    [gocNumber],
  )
  return rows
}

async function cleanup(): Promise<void> {
  await db.query(
    'delete from public.practitioners where goc_number = any($1)',
    [RESERVED],
  )
  await db.query(
    'delete from public.verifications where goc_number = any($1)',
    [RESERVED],
  )
}

afterAll(cleanup)

describe('submitSignupImpl', () => {
  beforeEach(cleanup)

  it('files a pending Practitioner when the register cannot be read', async () => {
    const { outcome } = await submitSignupImpl(prospect(AMBIGUOUS))

    expect(outcome).toBe('pending')
    const rows = await practitionerRows(AMBIGUOUS)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      full_name: 'Pending Prospect',
      email: `signup-${AMBIGUOUS}@example.co.uk`,
      verification_status: 'pending',
      subscription_status: 'incomplete',
      stripe_customer_id: null,
      // Nothing was confirmed, so nothing was verified at.
      last_verified_at: null,
    })
  })
  it('links the signup-time verification row to the Practitioner it filed', async () => {
    await submitSignupImpl(prospect(AMBIGUOUS))

    const { rows } = await db.query<{ practitioner_id: string | null }>(
      `select v.practitioner_id
         from public.verifications v
        where v.goc_number = $1`,
      [AMBIGUOUS],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].practitioner_id).not.toBeNull()
  })

  it('files the prospect once, however often they retry the check', async () => {
    await submitSignupImpl(prospect(AMBIGUOUS))
    const { outcome } = await submitSignupImpl(prospect(AMBIGUOUS))

    expect(outcome).toBe('pending')
    expect(await practitionerRows(AMBIGUOUS)).toHaveLength(1)
  })
  it('re-runs the check when the prospect presses "Try the check again"', async () => {
    await submitSignupImpl(prospect(UNREACHABLE))

    const { outcome } = await submitSignupImpl(prospect(UNREACHABLE), {
      retry: true,
    })

    // The attempt that produced the pending panel is what the 24h cache would
    // otherwise replay, which made the button a no-op for a day (issue #67).
    // A second row is the proof the register was actually asked again.
    expect(outcome).toBe('pending')
    expect(await verificationRowCount(UNREACHABLE)).toBe(2)
    expect(await practitionerRows(UNREACHABLE)).toHaveLength(1)
  })

  it('files nothing when the register says the number is not on it', async () => {
    const { outcome } = await submitSignupImpl(prospect(REJECTED))

    expect(outcome).toBe('rejected')
    expect(await practitionerRows(REJECTED)).toHaveLength(0)
  })

  it('leaves Practitioner creation to checkout when the register confirms the prospect', async () => {
    const { outcome } = await submitSignupImpl(prospect(VERIFIED))

    expect(outcome).toBe('verified')
    expect(await practitionerRows(VERIFIED)).toHaveLength(0)
  })

  it('files a prospect Manual Re-verification can act on', async () => {
    await submitSignupImpl(prospect(UNREACHABLE))

    // Before the prospect was filed this could only ever come back
    // `no-such-practitioner`, which made ADR-0014 unreachable (issue #66).
    const outcome = await runManualVerification({
      gocNumber: UNREACHABLE,
      force: true,
    })

    expect(outcome).toMatchObject({
      kind: 'applied',
      previousStatus: 'pending',
      result: 'error',
      newStatus: 'pending',
    })
  })
  it('files nothing when the email already belongs to another Practitioner', async () => {
    // Same email, a different GOC number: this is someone else's account, and
    // the prospect's attempt must not attach itself to it.
    const seeded = await db.query<{ id: string }>(
      `insert into public.practitioners
         (short_id, full_name, goc_number, profession_code, email,
          verification_status, subscription_status)
       values ('su-test-taken', 'Existing Practitioner', $1, 'optician', $2,
               'verified', 'active')
       returning id`,
      [VERIFIED, `signup-${AMBIGUOUS}@example.co.uk`],
    )

    const { outcome } = await submitSignupImpl(prospect(AMBIGUOUS))

    expect(outcome).toBe('pending')
    expect(await practitionerRows(AMBIGUOUS)).toHaveLength(0)
    const { rows } = await db.query<{ practitioner_id: string | null }>(
      'select practitioner_id from public.verifications where goc_number = $1',
      [AMBIGUOUS],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].practitioner_id).not.toBe(seeded.rows[0].id)
  })
})
