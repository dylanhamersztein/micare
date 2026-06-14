import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Client } from 'pg'
import sharp from 'sharp'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres'

const createdEmails: Array<string> = []

test.afterEach(async () => {
  if (createdEmails.length === 0) return
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      'delete from public.practitioners where email = any($1::text[])',
      [createdEmails],
    )
  } finally {
    await client.end()
    createdEmails.length = 0
  }
})

async function makePng(width: number, height: number): Promise<Buffer> {
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

async function signupCheckoutAndFillRequired(
  page: Page,
): Promise<{ suffix: string; slug: string; practiceName: string }> {
  await page.goto('/signup')
  await page
    .locator('[data-testid="signup-form"][data-hydrated="true"]')
    .waitFor()

  const suffix = `${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 10)}`
  const gocNumber = `99-${suffix}`
  const email = `slice9-${suffix}@example.co.uk`

  await page.getByTestId('signup-full-name').fill('Photo Optician')
  await page.getByTestId('signup-goc-number').fill(gocNumber)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('signup-verified')).toBeVisible()
  await page.getByTestId('signup-continue-to-payment').click()

  await page.waitForURL(/\/practitioner\/profile-editor\?short_id=/)
  await page
    .locator('[data-testid="profile-editor"][data-hydrated="true"]')
    .waitFor()

  const practiceName = `Photo Practice ${suffix}`
  await page.getByTestId('profile-practice-name').fill(practiceName)
  await page.getByTestId('profile-address-line1').fill('1 Photo Way')
  await page.getByTestId('profile-postcode').fill('EC2V 6AA')
  await page.getByTestId('profile-town').fill('London')
  await page
    .getByTestId('profile-booking-link')
    .fill('https://photo.example/book')
  await page.getByTestId('profile-hours-monday').fill('9:00-17:30')

  createdEmails.push(email)
  return {
    suffix,
    slug: `photo-practice-${suffix}`,
    practiceName,
  }
}

test('uploading a valid photo previews it and shows it on the public profile', async ({
  page,
}) => {
  await signupCheckoutAndFillRequired(page)

  const buffer = await makePng(800, 800)
  await page.getByTestId('profile-photo-input').setInputFiles({
    name: 'headshot.png',
    mimeType: 'image/png',
    buffer,
  })

  await expect(page.getByTestId('profile-photo-preview')).toBeVisible()

  await page.getByTestId('profile-save').click()
  await expect(page.getByTestId('profile-saved-visible')).toBeVisible()

  const profileUrl = await page.evaluate(() => window.location.href)
  const shortId = new URL(profileUrl).searchParams.get('short_id')
  expect(shortId).not.toBeNull()
  await page.goto(`/p/${shortId}/photo-practice`)
  await expect(page.getByTestId('profile-photo')).toBeVisible()
})

test('a no-face photo shows the no-face error and does not preview', async ({
  page,
}) => {
  await signupCheckoutAndFillRequired(page)

  const buffer = await makePng(800, 800)
  await page.getByTestId('profile-photo-input').setInputFiles({
    name: 'landscape-noface.png',
    mimeType: 'image/png',
    buffer,
  })

  const error = page.getByTestId('profile-photo-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('data-outcome', 'no-face')
  await expect(page.getByTestId('profile-photo-preview')).toHaveCount(0)
})

test('a multi-face photo shows the multi-face error', async ({ page }) => {
  await signupCheckoutAndFillRequired(page)

  const buffer = await makePng(800, 800)
  await page.getByTestId('profile-photo-input').setInputFiles({
    name: 'group-multiface.png',
    mimeType: 'image/png',
    buffer,
  })

  const error = page.getByTestId('profile-photo-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('data-outcome', 'multi-face')
})

test('a gif upload shows unsupported-type before hitting the server', async ({
  page,
}) => {
  await signupCheckoutAndFillRequired(page)

  await page.getByTestId('profile-photo-input').setInputFiles({
    name: 'animated.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  })

  const error = page.getByTestId('profile-photo-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('data-outcome', 'unsupported-type')
})

test('saving without uploading a photo still flips the listing visible (AC #4)', async ({
  page,
}) => {
  await signupCheckoutAndFillRequired(page)

  await page.getByTestId('profile-save').click()
  await expect(page.getByTestId('profile-saved-visible')).toBeVisible()
})
