import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { findPractitionerByEmail } from '../../src/server/practitioner-account'

const EMAIL = 'account-lookup@example.co.uk'

async function clearTestRows(): Promise<void> {
  await db.query(
    "delete from public.practitioners where email like '%@example.co.uk'",
  )
}

async function insertPractitioner(): Promise<void> {
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       practice_name, practice_town,
       verification_status, last_verified_at,
       subscription_status, stripe_customer_id, created_at
     ) values (
       'acctlk01', 'Account Lookup', '99-900001', 'optician', $1,
       'Lookup Practice', 'London',
       'verified', timestamptz '2026-05-01T00:00:00Z',
       'active', 'cus_test_lookup', timestamptz '2026-04-15T00:00:00Z'
     )`,
    [EMAIL],
  )
}

describe('findPractitionerByEmail', () => {
  beforeEach(async () => {
    await clearTestRows()
    await insertPractitioner()
  })
  afterEach(clearTestRows)

  it('maps a row to a camelCase PractitionerAccount', async () => {
    const account = await findPractitionerByEmail(EMAIL)
    expect(account).not.toBeNull()
    expect(account!.shortId).toBe('acctlk01')
    expect(account!.fullName).toBe('Account Lookup')
    expect(account!.verificationStatus).toBe('verified')
    expect(account!.subscriptionStatus).toBe('active')
    expect(account!.stripeCustomerId).toBe('cus_test_lookup')
    expect(account!.lastVerifiedAt?.toISOString()).toBe(
      '2026-05-01T00:00:00.000Z',
    )
    expect(account!.createdAt.toISOString()).toBe('2026-04-15T00:00:00.000Z')
  })

  it('matches case-insensitively', async () => {
    const account = await findPractitionerByEmail(EMAIL.toUpperCase())
    expect(account?.shortId).toBe('acctlk01')
  })

  it('returns null for an unknown email', async () => {
    expect(await findPractitionerByEmail('nobody@example.co.uk')).toBeNull()
  })
})
