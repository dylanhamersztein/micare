import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { loadDashboardImpl } from '../../src/server/dashboard-impl'

const EMAIL = 'dashboard@example.co.uk'
// Anchor (created_at) on the 15th; "now" mid-cycle so the current cycle is
// [2026-06-15, 2026-07-15).
const CREATED_AT = '2026-01-15T00:00:00Z'
const NOW = new Date('2026-06-20T00:00:00Z')

async function clearTestRows(): Promise<void> {
  await db.query(
    `delete from public.clickthroughs where practitioner_id in
       (select id from public.practitioners where email like '%@example.co.uk')`,
  )
  await db.query(
    "delete from public.practitioners where email like '%@example.co.uk'",
  )
}

async function insertPractitioner(): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       practice_name, practice_town,
       verification_status, last_verified_at, subscription_status, created_at
     ) values (
       'dash0001', 'Dana Board', '99-900003', 'optician', $1,
       'Board Optical', 'Bristol',
       'verified', timestamptz '2026-06-01T00:00:00Z', 'active', $2
     ) returning id`,
    [EMAIL, CREATED_AT],
  )
  return result.rows[0].id
}

async function insertClickthrough(
  practitionerId: string,
  occurredAt: string,
): Promise<void> {
  await db.query(
    `insert into public.clickthroughs (practitioner_id, hashed_visitor, occurred_at)
     values ($1, 'visitor-hash', $2)`,
    [practitionerId, occurredAt],
  )
}

describe('loadDashboardImpl', () => {
  let practitionerId: string
  beforeEach(async () => {
    await clearTestRows()
    practitionerId = await insertPractitioner()
  })
  afterEach(clearTestRows)

  it('counts only click-throughs inside the current billing cycle', async () => {
    await insertClickthrough(practitionerId, '2026-06-16T10:00:00Z') // in cycle
    await insertClickthrough(practitionerId, '2026-07-01T10:00:00Z') // in cycle
    await insertClickthrough(practitionerId, '2026-06-14T23:59:59Z') // before cycle start
    await insertClickthrough(practitionerId, '2026-07-15T00:00:00Z') // == cycle end (exclusive)

    const data = await loadDashboardImpl(EMAIL, NOW)
    expect(data).not.toBeNull()
    expect(data!.clickthroughCount).toBe(2)
    expect(data!.cycleStart).toBe('2026-06-15T00:00:00.000Z')
    expect(data!.cycleEnd).toBe('2026-07-15T00:00:00.000Z')
  })

  it('returns all six readouts', async () => {
    const data = await loadDashboardImpl(EMAIL, NOW)
    expect(data).toMatchObject({
      fullName: 'Dana Board',
      verificationStatus: 'verified',
      lastVerifiedAt: '2026-06-01T00:00:00.000Z',
      subscriptionStatus: 'active',
      clickthroughCount: 0,
      publicProfileUrl: '/p/dash0001/dana-board-board-optical-bristol',
    })
  })

  it('returns null when no Practitioner has that email', async () => {
    expect(await loadDashboardImpl('nobody@example.co.uk', NOW)).toBeNull()
  })
})
