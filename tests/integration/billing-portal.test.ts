import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createBillingPortalUrlImpl } from '../../src/server/billing-portal-impl'
import { db } from '../../src/server/db'

const EMAIL = 'portal@example.co.uk'

async function clearTestRows(): Promise<void> {
  await db.query(
    "delete from public.practitioners where email like '%@example.co.uk'",
  )
}

async function insertPractitioner(): Promise<void> {
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       verification_status, subscription_status, stripe_customer_id, created_at
     ) values (
       'portal01', 'Portia Bill', '99-900004', 'optician', $1,
       'verified', 'active', 'cus_test_portal', now()
     )`,
    [EMAIL],
  )
}

describe('createBillingPortalUrlImpl (VITE_STRIPE_MOCK=true)', () => {
  beforeEach(async () => {
    await clearTestRows()
    await insertPractitioner()
  })
  afterEach(clearTestRows)

  it('returns a deterministic in-app mock URL', async () => {
    const result = await createBillingPortalUrlImpl(EMAIL)
    expect(result).not.toBeNull()
    expect(result!.url).toBe('/dashboard?portal=mock')
  })

  it('returns null for an unknown email', async () => {
    expect(await createBillingPortalUrlImpl('nobody@example.co.uk')).toBeNull()
  })
})
