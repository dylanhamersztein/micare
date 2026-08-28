import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Client } from 'pg'

import {
  MULTI_FACE_PHOTO,
  NO_FACE_PHOTO,
  SINGLE_FACE_PHOTO,
  photoFixturePath,
} from '../fixtures/photos'

// Every assertion below that waits on an upload is waiting on a server that
// may be running face detection. With PHOTO_CHECK_MOCK=false the first upload
// in a fresh process pays to load the ~6MB SSD-MobileNet-v1 weights, and
// tfjs-node inference is CPU-bound on the same thread that serves every other
// request — so with workers in parallel a round trip queued behind that load
// runs well past Playwright's 5s default. Under the mocked default these
// resolve immediately and the longer ceiling costs nothing.
const expectUpload = expect.configure({ timeout: 30_000 })

// A single assertion here can spend 30s waiting, which does not fit inside
// Playwright's 30s default budget for a whole test that also signs a
// Practitioner up first.
test.describe.configure({ timeout: 120_000 })

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

  await page.waitForURL(/\/practitioner\/profile-editor$/)
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

  await page
    .getByTestId('profile-photo-input')
    .setInputFiles(photoFixturePath(SINGLE_FACE_PHOTO))

  await expectUpload(page.getByTestId('profile-photo-preview')).toBeVisible()

  await page.getByTestId('profile-save').click()
  await expectUpload(page.getByTestId('profile-saved-visible')).toBeVisible()

  // The editor no longer carries a short_id; the dashboard is where a
  // Practitioner is handed the public URL of their own listing.
  await page.goto('/dashboard')
  await page.getByTestId('dashboard-public-profile-link').click()
  await expect(page.getByTestId('profile-photo')).toBeVisible()
})

test('a no-face photo shows the no-face error and does not preview', async ({
  page,
}) => {
  await signupCheckoutAndFillRequired(page)

  await page
    .getByTestId('profile-photo-input')
    .setInputFiles(photoFixturePath(NO_FACE_PHOTO))

  const error = page.getByTestId('profile-photo-error')
  await expectUpload(error).toBeVisible()
  await expectUpload(error).toHaveAttribute('data-outcome', 'no-face')
  await expect(page.getByTestId('profile-photo-preview')).toHaveCount(0)
})

test('a multi-face photo shows the multi-face error', async ({ page }) => {
  await signupCheckoutAndFillRequired(page)

  await page
    .getByTestId('profile-photo-input')
    .setInputFiles(photoFixturePath(MULTI_FACE_PHOTO))

  const error = page.getByTestId('profile-photo-error')
  await expectUpload(error).toBeVisible()
  await expectUpload(error).toHaveAttribute('data-outcome', 'multi-face')
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
