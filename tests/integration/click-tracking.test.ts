import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { recordAndRedirect } from '../../src/server/click-tracking-impl'

const BOOKING_URL = 'https://clicktrack.example.co.uk/book'
const T0 = new Date('2026-08-01T10:00:00Z')
// Just inside / just outside the 24h dedup window measured from T0.
const WITHIN_WINDOW = new Date('2026-08-02T09:59:59Z')
const AFTER_WINDOW = new Date('2026-08-02T10:00:01Z')

function clickFrom(ip: string, userAgent = 'Firefox'): Request {
  return new Request('https://micare.example/go?p=clicktrk', {
    headers: { 'x-forwarded-for': ip, 'user-agent': userAgent },
  })
}

async function clearTestRows(): Promise<void> {
  await db.query(
    `delete from public.clickthroughs where practitioner_id in
       (select id from public.practitioners where email like '%@clicktrack.example.co.uk')`,
  )
  await db.query(
    "delete from public.practitioners where email like '%@clicktrack.example.co.uk'",
  )
}

async function insertPractitioner(
  shortId: string,
  verificationStatus: string,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       practice_name, practice_address_line1, practice_postcode, practice_town,
       booking_link_url, verification_status, subscription_status
     ) values (
       $1, 'Clare Track', $2, 'optician', $3,
       'Track Optical', '1 Click Street', 'BS1 1AA', 'Bristol',
       $4, $5, 'active'
     ) returning id`,
    [
      shortId,
      `88-${shortId.slice(-6)}`,
      `${shortId}@clicktrack.example.co.uk`,
      BOOKING_URL,
      verificationStatus,
    ],
  )
  return result.rows[0].id
}

async function countClicks(practitionerId: string): Promise<number> {
  const result = await db.query<{ count: number }>(
    'select count(*)::int as count from public.clickthroughs where practitioner_id = $1',
    [practitionerId],
  )
  return result.rows[0].count
}

describe('recordAndRedirect', () => {
  let practitionerId: string

  beforeEach(async () => {
    await clearTestRows()
    practitionerId = await insertPractitioner('clicktrk', 'verified')
  })
  afterEach(clearTestRows)

  it('returns the Booking Link and records the first click', async () => {
    const outcome = await recordAndRedirect(
      'clicktrk',
      clickFrom('203.0.113.7'),
      T0,
    )

    expect(outcome).toEqual({ kind: 'redirect', url: BOOKING_URL })
    expect(await countClicks(practitionerId)).toBe(1)
  })

  it('stores an opaque hash rather than the raw IP address', async () => {
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7'), T0)

    const result = await db.query<{ hashed_visitor: string }>(
      'select hashed_visitor from public.clickthroughs where practitioner_id = $1',
      [practitionerId],
    )
    expect(result.rows[0].hashed_visitor).not.toContain('203.0.113.7')
    expect(result.rows[0].hashed_visitor).toMatch(/^[0-9a-f]{64}$/)
  })

  it('does not record a repeat click from the same visitor inside 24h', async () => {
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7'), T0)
    const outcome = await recordAndRedirect(
      'clicktrk',
      clickFrom('203.0.113.7'),
      WITHIN_WINDOW,
    )

    // Still redirects — dedup suppresses the count, never the consumer's click.
    expect(outcome).toEqual({ kind: 'redirect', url: BOOKING_URL })
    expect(await countClicks(practitionerId)).toBe(1)
  })

  it('records again once the dedup window has expired', async () => {
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7'), T0)
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7'), AFTER_WINDOW)

    expect(await countClicks(practitionerId)).toBe(2)
  })

  it('records a different IP as a separate visitor', async () => {
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7'), T0)
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.8'), T0)

    expect(await countClicks(practitionerId)).toBe(2)
  })

  it('records a different user agent as a separate visitor', async () => {
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7', 'Firefox'), T0)
    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7', 'Safari'), T0)

    expect(await countClicks(practitionerId)).toBe(2)
  })

  it('keeps each Practitioner dedup window independent', async () => {
    const otherId = await insertPractitioner('clicktrq', 'verified')

    await recordAndRedirect('clicktrk', clickFrom('203.0.113.7'), T0)
    await recordAndRedirect('clicktrq', clickFrom('203.0.113.7'), T0)

    expect(await countClicks(practitionerId)).toBe(1)
    expect(await countClicks(otherId)).toBe(1)
  })

  it('returns unknown for an unrecognised short_id without writing a row', async () => {
    const outcome = await recordAndRedirect(
      'zzzzzzzz',
      clickFrom('203.0.113.7'),
      T0,
    )

    expect(outcome).toEqual({ kind: 'unknown' })
    expect(await countClicks(practitionerId)).toBe(0)
  })

  it('returns unknown for a Practitioner who is not publicly visible', async () => {
    const revokedId = await insertPractitioner('clicktrv', 'revoked')

    const outcome = await recordAndRedirect(
      'clicktrv',
      clickFrom('203.0.113.7'),
      T0,
    )

    expect(outcome).toEqual({ kind: 'unknown' })
    expect(await countClicks(revokedId)).toBe(0)
  })
})
