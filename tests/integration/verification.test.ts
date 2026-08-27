import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { verify } from '../../src/server/verification-impl'

// All test numbers use the reserved 99- prefix; clearing them keeps the test
// deterministic against the persistent local database and the 24h cache.
async function clearTestVerifications(): Promise<void> {
  await db.query(
    "delete from public.verifications where goc_number like '99-%'",
  )
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
    const result = await verify(
      'optician',
      'Mock Verified Optician',
      '99-000001',
    )

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
    const first = await verify(
      'optician',
      'Mock Verified Optician',
      '99-000001',
    )
    const second = await verify(
      'optician',
      'Mock Verified Optician',
      '99-000001',
    )

    expect(second).toEqual(first)
    expect(await countRows('99-000001')).toBe(1)
  })

  it('goes back to the register for a retry of a result that was never an answer', async () => {
    await verify('optician', 'Unreachable Register', '99-000004')

    const retried = await verify(
      'optician',
      'Unreachable Register',
      '99-000004',
      { retry: true },
    )

    // A fresh attempt, not the cached one: an attempt writes a row, a cache
    // hit does not (issue #67).
    expect(retried.kind).toBe('error')
    expect(await countRows('99-000004')).toBe(2)
  })

  // Issue #68: the register answers a number, not a person. 99-000005 is the
  // mock fixture whose registrant is somebody in particular, so a submission
  // under any other name is a name mismatch.
  it('rejects a live registration claimed under the wrong name', async () => {
    const result = await verify('optician', 'Somebody Else', '99-000005')

    expect(result.kind).toBe('name-mismatch')
    const row = await db.query<{ status: string }>(
      'select status from public.verifications where goc_number = $1',
      ['99-000005'],
    )
    expect(row.rows[0].status).toBe('rejected')
  })

  it('verifies the registrant the mock register actually holds', async () => {
    const result = await verify('optician', 'Ethan Belson', '99-000005')

    expect(result.kind).toBe('found-active')
  })

  it('will not let the 24h cache hand one prospect another registrant', async () => {
    await verify('optician', 'Ethan Belson', '99-000005')

    const impostor = await verify('optician', 'Somebody Else', '99-000005')

    // Served from the cache — no second scrape — but adjudicated against the
    // name this caller submitted, not the one that filled the cache.
    expect(impostor.kind).toBe('name-mismatch')
    expect(await countRows('99-000005')).toBe(1)
  })

  it('will not let the 24h cache lock the real registrant out either', async () => {
    await verify('optician', 'Somebody Else', '99-000005')

    const registrant = await verify('optician', 'Ethan Belson', '99-000005')

    expect(registrant.kind).toBe('found-active')
    expect(await countRows('99-000005')).toBe(1)
  })

  it('serves a retry from cache once the register has given an answer', async () => {
    await verify('optician', 'Nobody', '99-000002')

    await verify('optician', 'Nobody', '99-000002', { retry: true })

    // No amount of pressing changes a register that has already spoken, and
    // the cache is what keeps MiCare's scrape volume down.
    expect(await countRows('99-000002')).toBe(1)
  })
})
