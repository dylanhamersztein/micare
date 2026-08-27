import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { uploadPractitionerPhoto } from '../../src/server/photo-upload-impl'
import { hasMinFields, isVisible } from '../../src/visibility'
import type {
  SubscriptionStatus,
  VerificationStatus,
} from '../../src/visibility'

const TEST_GOC = '99-300001'
const TEST_EMAIL = 'photo-test@example.co.uk'
const TEST_SHORT_ID = 'phup1234'

async function clearTestRows(): Promise<void> {
  await db.query('delete from public.practitioners where email = $1', [
    TEST_EMAIL,
  ])
}

async function insertPractitioner(): Promise<void> {
  await db.query(
    `insert into public.practitioners (
       short_id, full_name, goc_number, profession_code, email,
       verification_status, subscription_status
     ) values ($1, 'Photo Tester', $2, 'optician', $3,
               'verified', 'active')`,
    [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL],
  )
}

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .png()
    .toBuffer()
}

function asBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

// Visibility is computed, never stored (ADR-0024), so the test asks the same
// predicate the consumer surfaces ask.
async function isPractitionerVisible(): Promise<boolean> {
  const { rows } = await db.query<{
    full_name: string
    practice_name: string | null
    practice_address_line1: string | null
    practice_postcode: string | null
    booking_link_url: string | null
    verification_status: VerificationStatus
    subscription_status: SubscriptionStatus
  }>(
    `select full_name, practice_name, practice_address_line1,
            practice_postcode, booking_link_url,
            verification_status, subscription_status
       from public.practitioners where short_id = $1`,
    [TEST_SHORT_ID],
  )
  const row = rows[0]
  return isVisible({
    verificationStatus: row.verification_status,
    subscriptionStatus: row.subscription_status,
    minFieldsFilled: hasMinFields({
      fullName: row.full_name,
      practiceName: row.practice_name,
      practiceAddressLine1: row.practice_address_line1,
      practicePostcode: row.practice_postcode,
      bookingLinkUrl: row.booking_link_url,
    }),
  })
}

describe('uploadPractitionerPhoto', () => {
  beforeEach(async () => {
    await clearTestRows()
    await insertPractitioner()
  })

  afterEach(async () => {
    await clearTestRows()
  })

  it('saves the photo URL and returns ok for a passing image', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(buffer),
      filename: 'headshot.png',
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw new Error('expected ok')
    expect(result.photoUrl).toMatch(/^data:image\/png;base64,/)

    const row = await db.query<{ photo_url: string | null }>(
      `select photo_url from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].photo_url).toBe(result.photoUrl)
  })

  it('returns unsupported-type for image/gif and does not touch photo_url', async () => {
    const result = await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(Buffer.from([0x47, 0x49, 0x46])),
      filename: 'animated.gif',
    })

    expect(result).toEqual({ kind: 'unsupported-type' })
    const row = await db.query<{ photo_url: string | null }>(
      `select photo_url from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].photo_url).toBeNull()
  })

  it('returns too-large when the decoded byte size exceeds 5 MB', async () => {
    // A 5.5 MB buffer of any contents — MIME check passes (we say png), byte
    // check fails before sharp is even asked to decode.
    const buffer = Buffer.alloc(5.5 * 1024 * 1024, 0)
    const result = await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(buffer),
      filename: 'huge.png',
    })

    expect(result).toEqual({ kind: 'too-large' })
  })

  it('returns too-small for a 100×100 png', async () => {
    const buffer = await makePngBuffer(100, 100)
    const result = await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(buffer),
      filename: 'tiny.png',
    })

    expect(result).toEqual({ kind: 'too-small' })
  })

  it('returns no-face via the mock when the filename suffix triggers it', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(buffer),
      filename: 'sample-noface.png',
    })

    expect(result).toEqual({ kind: 'no-face' })
    const row = await db.query<{ photo_url: string | null }>(
      `select photo_url from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].photo_url).toBeNull()
  })

  it('returns multi-face via the mock when the filename suffix triggers it', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(buffer),
      filename: 'group-multiface.png',
    })

    expect(result).toEqual({ kind: 'multi-face' })
  })

  it('returns unknown when no Practitioner row matches the session email', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      email: 'nobody@example.co.uk',
      fileBase64: asBase64(buffer),
      filename: 'headshot.png',
    })

    expect(result).toEqual({ kind: 'unknown' })
  })

  // short_id is public — it is in every /p/<short_id>/<slug> URL and every
  // /go?p=<short_id> link. A visitor must not be able to put a photo on a
  // verified Practitioner's listing by quoting it.
  it('refuses a Practitioner addressed by their public short_id', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      email: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      filename: 'headshot.png',
    })

    expect(result).toEqual({ kind: 'unknown' })
    const row = await db.query<{ photo_url: string | null }>(
      `select photo_url from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].photo_url).toBeNull()
  })

  // AC #4: the photo is optional. Uploading one must not change whether the
  // Practitioner is listed — visibility reads verification, subscription and
  // the minimum profile fields, and a headshot is none of those.
  it('leaves a listed Practitioner listed when the photo is saved (AC #4: optional)', async () => {
    await db.query(
      `update public.practitioners
          set practice_name          = 'Photo Practice',
              practice_address_line1 = '1 Camera Lane',
              practice_postcode      = 'NR1 3DD',
              booking_link_url       = 'https://example.test/book'
        where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(await isPractitionerVisible()).toBe(true)

    const buffer = await makePngBuffer(800, 800)
    await uploadPractitionerPhoto({
      email: TEST_EMAIL,
      fileBase64: asBase64(buffer),
      filename: 'headshot.png',
    })

    expect(await isPractitionerVisible()).toBe(true)
  })
})
