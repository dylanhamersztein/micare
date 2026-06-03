import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'
import { uploadPractitionerPhoto } from '../../src/server/photo-upload-impl'

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
       verification_status, subscription_status, visible
     ) values ($1, 'Photo Tester', $2, 'optician', $3,
               'verified', 'active', true)`,
    [TEST_SHORT_ID, TEST_GOC, TEST_EMAIL],
  )
}

async function makePngBuffer(
  width: number,
  height: number,
): Promise<Buffer> {
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
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
      filename: 'headshot.png',
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw new Error('expected ok')
    expect(result.photoUrl).toMatch(
      new RegExp(`/practitioner-photos/${TEST_SHORT_ID}/photo\\.png$`),
    )

    const row = await db.query<{ photo_url: string | null }>(
      `select photo_url from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].photo_url).toBe(result.photoUrl)
  })

  it('returns unsupported-type for image/gif and does not touch photo_url', async () => {
    const result = await uploadPractitionerPhoto({
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(Buffer.from([0x47, 0x49, 0x46])),
      mimeType: 'image/gif',
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
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
      filename: 'huge.png',
    })

    expect(result).toEqual({ kind: 'too-large' })
  })

  it('returns too-small for a 100×100 png', async () => {
    const buffer = await makePngBuffer(100, 100)
    const result = await uploadPractitionerPhoto({
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
      filename: 'tiny.png',
    })

    expect(result).toEqual({ kind: 'too-small' })
  })

  it('returns no-face via the mock when the filename suffix triggers it', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
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
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
      filename: 'group-multiface.png',
    })

    expect(result).toEqual({ kind: 'multi-face' })
  })

  it('returns unknown when no Practitioner row matches the short_id', async () => {
    const buffer = await makePngBuffer(800, 800)
    const result = await uploadPractitionerPhoto({
      shortId: 'nopenope',
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
      filename: 'headshot.png',
    })

    expect(result).toEqual({ kind: 'unknown' })
  })

  it('does not change visible when the photo is saved (AC #4: optional)', async () => {
    await db.query(
      `update public.practitioners set visible = true where short_id = $1`,
      [TEST_SHORT_ID],
    )
    const buffer = await makePngBuffer(800, 800)
    await uploadPractitionerPhoto({
      shortId: TEST_SHORT_ID,
      fileBase64: asBase64(buffer),
      mimeType: 'image/png',
      filename: 'headshot.png',
    })

    const row = await db.query<{ visible: boolean }>(
      `select visible from public.practitioners where short_id = $1`,
      [TEST_SHORT_ID],
    )
    expect(row.rows[0].visible).toBe(true)
  })
})
