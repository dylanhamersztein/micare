import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { verify } from '../../src/server/verification-impl'

// All test numbers use the reserved 99- prefix; clearing them keeps the test
// deterministic against the persistent local database and the 24h cache.
async function clearTestVerifications(): Promise<void> {
  await db.query("delete from public.verifications where goc_number like '99-%'")
}

async function countRows(gocNumber: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    'select count(*) as count from public.verifications where goc_number = $1',
    [gocNumber],
  )
  return Number(result.rows[0].count)
}

describe('verify (GOC_MOCK path)', () => {
  beforeEach(clearTestVerifications)

  it('writes a verifications row for a found-active mock attempt', async () => {
    const result = await verify('optician', 'Mock Verified Optician', '99-000001')

    expect(result.kind).toBe('found-active')
    expect(await countRows('99-000001')).toBe(1)

    const row = await db.query<{
      status: string
      practitioner_id: string | null
      goc_number: string
    }>(
      'select status, practitioner_id, goc_number from public.verifications where goc_number = $1',
      ['99-000001'],
    )
    expect(row.rows[0].status).toBe('verified')
    expect(row.rows[0].practitioner_id).toBeNull()
    expect(row.rows[0].goc_number).toBe('99-000001')
  })

  it('records a not-found mock attempt as a rejected verification', async () => {
    const result = await verify('optician', 'Nobody', '99-000002')

    expect(result.kind).toBe('not-found')
    const row = await db.query<{ status: string }>(
      'select status from public.verifications where goc_number = $1',
      ['99-000002'],
    )
    expect(row.rows[0].status).toBe('rejected')
  })

  it('serves a second call within 24h from cache without a new row', async () => {
    const first = await verify('optician', 'Mock Verified Optician', '99-000001')
    const second = await verify('optician', 'Mock Verified Optician', '99-000001')

    expect(second).toEqual(first)
    expect(await countRows('99-000001')).toBe(1)
  })
})
