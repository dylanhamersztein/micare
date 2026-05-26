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
    expect(result.redirectTo).toMatch(/^\/practitioner\/profile-editor/)

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
})
