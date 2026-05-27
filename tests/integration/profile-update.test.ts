import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../src/server/db'
import { updateProfile } from '../../src/server/profile-update-impl'

const TEST_GOC = '99-200001'
const TEST_EMAIL = 'update-test@example.co.uk'
const TEST_SHORT_ID = 'updt1234'

const VALID_INPUT = {
  practiceName: 'Update Practice',
  practiceAddressLine1: '99 New Street',
  practiceAddressLine2: null,
  practiceAddressLine3: null,
  practicePostcode: 'EC2V 6AA',
  practiceTown: 'London',
  bookingLinkUrl: 'https://update.example/book',
  openingHours: { Monday: '9:00-17:30' },
  byAppointmentOnly: false,
  bio: null,
  photoUrl: null,
  services: [],
  languages: [],
  accessibilityNotes: null,
  acceptingNewPatients: true,
}

function geocodeOk(): Response {
  return new Response(
    JSON.stringify({
      status: 200,
      result: { postcode: 'EC2V 6AA', longitude: -0.0921, latitude: 51.5144 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function geocodeNotFound(): Response {
  return new Response(
    JSON.stringify({ status: 404, error: 'Postcode not found' }),
    { status: 404, headers: { 'content-type': 'application/json' } },
  )
}

async function clearTestRows(): Promise<void> {
  await db.query("delete from public.verifications where goc_number = $1", [TEST_GOC])
  await db.query("delete from public.practitioners where email = $1", [TEST_EMAIL])
}

async function insertEmptyPractitioner(): Promise<void> {
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       verification_status, last_verified_at, subscription_status,
       visible
     ) values ($1, 'Update Tester', $2, 'optician', $3,
               'verified', now(), 'active',
               false)`,
    [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL],
  )
}

describe('updateProfile', () => {
  beforeEach(async () => {
    await clearTestRows()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await clearTestRows()
  })

  it('writes every editable field, geocodes the postcode into practice_point, and flips visible=true', async () => {
    await insertEmptyPractitioner()
    vi.mocked(fetch).mockResolvedValueOnce(geocodeOk())

    const result = await updateProfile(TEST_SHORT_ID, VALID_INPUT)

    expect(result).toEqual({ kind: 'saved', visible: true })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.postcodes.io/postcodes/EC2V%206AA',
      expect.any(Object),
    )

    const row = await db.query<{
      practice_name: string
      practice_address_line1: string
      practice_postcode: string
      practice_town: string
      booking_link_url: string
      opening_hours: Record<string, string> | null
      by_appointment_only: boolean
      visible: boolean
      practice_point: string | null
    }>(
      `select practice_name, practice_address_line1, practice_postcode,
              practice_town, booking_link_url, opening_hours,
              by_appointment_only, visible, practice_point::text as practice_point
         from public.practitioners
        where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0]).toMatchObject({
      practice_name: 'Update Practice',
      practice_address_line1: '99 New Street',
      practice_postcode: 'EC2V 6AA',
      practice_town: 'London',
      booking_link_url: 'https://update.example/book',
      opening_hours: { Monday: '9:00-17:30' },
      by_appointment_only: false,
      visible: true,
    })
    expect(row.rows[0].practice_point).not.toBeNull()
  })

  it('keeps visible=false when required fields are present but subscription is canceled', async () => {
    await db.query(
      `insert into public.practitioners (
         short_id, full_name, goc_number, profession_code, email,
         verification_status, last_verified_at, subscription_status, visible
       ) values ($1, 'Canceled Tester', $2, 'optician', $3,
                 'verified', now(), 'canceled', false)`,
      [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL],
    )
    vi.mocked(fetch).mockResolvedValueOnce(geocodeOk())

    const result = await updateProfile(TEST_SHORT_ID, VALID_INPUT)

    expect(result).toEqual({ kind: 'saved', visible: false })
    const row = await db.query<{ visible: boolean }>(
      `select visible from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].visible).toBe(false)
  })

  it('returns postcode-not-found and does not touch the row when geocode 404s', async () => {
    await insertEmptyPractitioner()
    vi.mocked(fetch).mockResolvedValueOnce(geocodeNotFound())

    const result = await updateProfile(TEST_SHORT_ID, VALID_INPUT)

    expect(result).toEqual({ kind: 'postcode-not-found' })
    const row = await db.query<{ practice_name: string | null; visible: boolean }>(
      `select practice_name, visible from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].practice_name).toBeNull()
    expect(row.rows[0].visible).toBe(false)
  })

  it('returns unknown when no Practitioner row matches the short_id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(geocodeOk())

    const result = await updateProfile('zzzzzzzz', VALID_INPUT)

    expect(result).toEqual({ kind: 'unknown' })
  })

  it('returns invalid with per-field errors and does not call fetch when Zod rejects', async () => {
    await insertEmptyPractitioner()

    const result = await updateProfile(TEST_SHORT_ID, {
      ...VALID_INPUT,
      practiceName: '',
      bookingLinkUrl: 'not-a-url',
    })

    expect(result.kind).toBe('invalid')
    if (result.kind !== 'invalid') throw new Error('expected invalid')
    expect(result.fieldErrors.practiceName).toBeTruthy()
    expect(result.fieldErrors.bookingLinkUrl).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
