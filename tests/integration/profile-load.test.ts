import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { loadEditableProfile } from '../../src/server/profile-load-impl'

const TEST_GOC = '99-100001'
const TEST_EMAIL = 'load-test@example.co.uk'
const TEST_SHORT_ID = 'load1234'

async function clearTestRows(): Promise<void> {
  await db.query('delete from public.verifications where goc_number = $1', [
    TEST_GOC,
  ])
  await db.query('delete from public.practitioners where email = $1', [
    TEST_EMAIL,
  ])
}

async function insertFixture(): Promise<void> {
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       verification_status, last_verified_at,
       subscription_status,
       practice_name, practice_address_line1, practice_postcode, practice_town,
       opening_hours, by_appointment_only,
       booking_link_url, bio, services, languages,
       accessibility_notes, accepting_new_patients
     ) values (
       $1, 'Test Practitioner', $2, 'optician', $3,
       'verified', now(),
       'active',
       'Test Practice', '1 Test Street', 'EC2V 6AA', 'London',
       $4::jsonb, false,
       'https://test.example/book', 'A short bio.', array['Eye exam'], array['English'],
       'Step-free.', true
     )`,
    [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL, '{"Monday":"9:00-17:30"}'],
  )
}

describe('loadEditableProfile', () => {
  beforeEach(async () => {
    await clearTestRows()
  })
  afterEach(clearTestRows)

  it('returns every editable field for the session’s email', async () => {
    await insertFixture()

    const profile = await loadEditableProfile(TEST_EMAIL)

    expect(profile).not.toBeNull()
    expect(profile).toMatchObject({
      shortId: TEST_SHORT_ID,
      fullName: 'Test Practitioner',
      practiceName: 'Test Practice',
      practiceAddressLine1: '1 Test Street',
      practicePostcode: 'EC2V 6AA',
      practiceTown: 'London',
      bookingLinkUrl: 'https://test.example/book',
      openingHours: { Monday: '9:00-17:30' },
      byAppointmentOnly: false,
      bio: 'A short bio.',
      services: ['Eye exam'],
      languages: ['English'],
      accessibilityNotes: 'Step-free.',
      acceptingNewPatients: true,
    })
  })

  it('matches the email case-insensitively, as the login path does', async () => {
    await insertFixture()

    const profile = await loadEditableProfile(TEST_EMAIL.toUpperCase())

    expect(profile?.shortId).toBe(TEST_SHORT_ID)
  })

  // short_id is public — it is in every /p/<short_id>/<slug> URL and every
  // /go?p=<short_id> link. The editor must not be reachable by it.
  it('does not resolve a Practitioner by their public short_id', async () => {
    await insertFixture()

    expect(await loadEditableProfile(TEST_SHORT_ID)).toBeNull()
  })

  it('returns null for an email with no Practitioner', async () => {
    expect(await loadEditableProfile('nobody@example.co.uk')).toBeNull()
  })

  it('returns sensible defaults for a row with null nullable fields', async () => {
    await db.query(
      `insert into public.practitioners (
         short_id, full_name, goc_number, profession_code, email,
         verification_status, last_verified_at, subscription_status
       ) values ($1, 'Skeleton', $2, 'optician', $3, 'verified', now(), 'active')`,
      [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL],
    )

    const profile = await loadEditableProfile(TEST_EMAIL)

    expect(profile).not.toBeNull()
    expect(profile?.practiceName).toBeNull()
    expect(profile?.openingHours).toBeNull()
    expect(profile?.byAppointmentOnly).toBe(false)
    expect(profile?.services).toEqual([])
    expect(profile?.languages).toEqual([])
    expect(profile?.acceptingNewPatients).toBe(true)
  })
})
