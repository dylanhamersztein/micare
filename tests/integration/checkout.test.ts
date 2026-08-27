import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { startCheckoutImpl } from '../../src/server/checkout-impl'

const MOCK_GOC_NUMBER = '99-000001'
const MOCK_EMAIL = 'checkout-mock@example.co.uk'

async function clearTestRows(): Promise<void> {
  await db.query(
    "delete from public.verifications where goc_number like '99-%'",
  )
  await db.query(
    "delete from public.practitioners where email like '%@example.co.uk'",
  )
}

describe('startCheckout (VITE_STRIPE_MOCK=true)', () => {
  beforeEach(clearTestRows)

  it('inserts a verified Practitioner with synthetic stripe IDs and subscription_status=active', async () => {
    const result = await startCheckoutImpl({
      fullName: 'Mock Optician',
      professionCode: 'optician',
      gocNumber: MOCK_GOC_NUMBER,
      email: MOCK_EMAIL,
    })

    expect(result.kind).toBe('mock')
    if (result.kind !== 'mock') throw new Error('expected mock result')
    // No `?short_id=`: the editor resolves the Practitioner from the session
    // (ADR-0006), and short_id is public enough to be in every profile URL.
    expect(result.redirectTo).toBe('/practitioner/profile-editor')

    const row = await db.query<{
      verification_status: string
      subscription_status: string
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
    }>(
      `select verification_status, subscription_status,
              stripe_customer_id, stripe_subscription_id
         from public.practitioners
        where email = $1`,
      [MOCK_EMAIL],
    )
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0].verification_status).toBe('verified')
    expect(row.rows[0].subscription_status).toBe('active')
    expect(row.rows[0].stripe_customer_id).toMatch(/^cus_mock_/)
    expect(row.rows[0].stripe_subscription_id).toMatch(/^sub_mock_/)
  })

  it('rejects a signup payload whose GOC number is not verified', async () => {
    await expect(
      startCheckoutImpl({
        fullName: 'Rejected Optician',
        professionCode: 'optician',
        gocNumber: '99-000002',
        email: 'rejected@example.co.uk',
      }),
    ).rejects.toThrow(/not verified/i)
  })

  it('back-fills practitioner_id on the matching verifications row', async () => {
    await startCheckoutImpl({
      fullName: 'Mock Optician',
      professionCode: 'optician',
      gocNumber: MOCK_GOC_NUMBER,
      email: MOCK_EMAIL,
    })

    const result = await db.query<{ practitioner_id: string | null }>(
      `select practitioner_id from public.verifications where goc_number = $1`,
      [MOCK_GOC_NUMBER],
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].practitioner_id).not.toBeNull()
  })
  // Issue #66: signup files an unreadable-register prospect as a `pending`
  // Practitioner so Manual Re-verification has a row to act on. When that
  // prospect comes back and the register answers, checkout must take over the
  // row it already has — inserting a second one collides on goc_number, and
  // the session minted in checkout.ts resolves by email.
  it('adopts the pending Practitioner signup filed, rather than inserting a second row', async () => {
    const seeded = await db.query<{ id: string }>(
      `insert into public.practitioners
         (short_id, full_name, goc_number, profession_code, email,
          verification_status, subscription_status)
       values ('co-test-pending', 'Pending Prospect', $1, 'optician', $2,
               'pending', 'incomplete')
       returning id`,
      [MOCK_GOC_NUMBER, MOCK_EMAIL],
    )

    await startCheckoutImpl({
      fullName: 'Mock Optician',
      professionCode: 'optician',
      gocNumber: MOCK_GOC_NUMBER,
      email: MOCK_EMAIL,
    })

    const { rows } = await db.query<{
      id: string
      full_name: string
      verification_status: string
      subscription_status: string
      stripe_customer_id: string | null
      last_verified_at: Date | null
    }>(
      `select id, full_name, verification_status, subscription_status,
              stripe_customer_id, last_verified_at
         from public.practitioners
        where goc_number = $1`,
      [MOCK_GOC_NUMBER],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(seeded.rows[0].id)
    expect(rows[0]).toMatchObject({
      full_name: 'Mock Optician',
      verification_status: 'verified',
      subscription_status: 'active',
    })
    expect(rows[0].stripe_customer_id).toMatch(/^cus_mock_/)
    expect(rows[0].last_verified_at).not.toBeNull()
  })
})
