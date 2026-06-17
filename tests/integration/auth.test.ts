import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  consumeMagicLinkImpl,
  requestMagicLinkImpl,
} from '../../src/server/auth-impl'
import { db } from '../../src/server/db'

const EMAIL = 'magic-link@example.co.uk'

async function clearTestRows(): Promise<void> {
  await db.query(
    "delete from public.practitioners where email like '%@example.co.uk'",
  )
}

async function insertPractitioner(): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       verification_status, last_verified_at, subscription_status, created_at
     ) values (
       'maglnk01', 'Magic Linker', '99-900002', 'optician', $1,
       'verified', now(), 'active', now()
     ) returning id`,
    [EMAIL],
  )
  return result.rows[0].id
}

describe('magic-link (AUTH_MOCK=true)', () => {
  let practitionerId: string
  beforeEach(async () => {
    await clearTestRows()
    practitionerId = await insertPractitioner()
  })
  afterEach(clearTestRows)

  it('requestMagicLinkImpl returns a clickable callback path in mock mode', async () => {
    const result = await requestMagicLinkImpl(EMAIL)
    expect(result.kind).toBe('mock')
    if (result.kind !== 'mock') throw new Error('expected mock result')
    expect(result.magicLinkPath).toMatch(/^\/auth\/callback\?token=/)
  })

  it('a freshly-requested link consumes to the matching practitioner', async () => {
    const requested = await requestMagicLinkImpl(EMAIL)
    if (requested.kind !== 'mock') throw new Error('expected mock result')
    const token = new URL(
      `http://x${requested.magicLinkPath}`,
    ).searchParams.get('token')!

    const consumed = await consumeMagicLinkImpl(token)
    expect(consumed.kind).toBe('ok')
    if (consumed.kind !== 'ok') throw new Error('expected ok')
    expect(consumed.practitionerId).toBe(practitionerId)
    expect(consumed.email).toBe(EMAIL)
  })

  it('rejects a garbage token', async () => {
    expect((await consumeMagicLinkImpl('garbage.token')).kind).toBe('invalid')
  })

  it('rejects a valid token whose email is not a Practitioner', async () => {
    // Request for an email that has no practitioner row, then consume.
    const requested = await requestMagicLinkImpl('stranger@example.co.uk')
    if (requested.kind !== 'mock') throw new Error('expected mock result')
    const token = new URL(
      `http://x${requested.magicLinkPath}`,
    ).searchParams.get('token')!
    expect((await consumeMagicLinkImpl(token)).kind).toBe('invalid')
  })
})
