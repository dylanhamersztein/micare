import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Client } from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres'

// e2e tests for the profile editor create real, visible Practitioner rows.
// Without cleanup they would inflate the result count in search.spec.ts,
// which asserts exactly two visible Practitioners within EC2V 6AA / 5mi.
const createdEmails: Array<string> = []

test.afterEach(async () => {
  if (createdEmails.length === 0) return
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    // verifications cascades from practitioners.
    await client.query(
      'delete from public.practitioners where email = any($1::text[])',
      [createdEmails],
    )
  } finally {
    await client.end()
    createdEmails.length = 0
  }
})

async function signupVerifiedAndCheckout(
  page: Page,
): Promise<{ gocNumber: string; email: string }> {
  await page.goto('/signup')
  await page
    .locator('[data-testid="signup-form"][data-hydrated="true"]')
    .waitFor()

  // Combine timestamp + random so two tests starting in the same millisecond
  // (under `fullyParallel: true`) cannot collide on the unique email / GOC
  // constraints in public.practitioners.
  const suffix = `${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 10)}`
  const gocNumber = `99-${suffix}`
  const email = `slice8-${suffix}@example.co.uk`

  await page.getByTestId('signup-full-name').fill('Editor Optician')
  await page.getByTestId('signup-goc-number').fill(gocNumber)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('signup-verified')).toBeVisible()
  await page.getByTestId('signup-continue-to-payment').click()

  await page.waitForURL(/\/practitioner\/profile-editor\?short_id=/)
  await page
    .locator('[data-testid="profile-editor"][data-hydrated="true"]')
    .waitFor()

  createdEmails.push(email)
  return { gocNumber, email }
}

test('a paid Practitioner who fills required fields appears on /search immediately', async ({
  page,
}) => {
  await signupVerifiedAndCheckout(page)

  const suffix = String(Date.now()).slice(-6)
  const practiceName = `Editor Practice ${suffix}`

  // Use a Manchester postcode so this test's newly-visible row does not
  // race with search.spec.ts's EC2V 6AA count assertion under
  // `fullyParallel: true`. The search-result assertion below uses the
  // unique generated practice name, so it survives any other rows that
  // happen to share the area.
  await page.getByTestId('profile-practice-name').fill(practiceName)
  await page.getByTestId('profile-address-line1').fill('1 Editor Way')
  await page.getByTestId('profile-postcode').fill('M3 2BW')
  await page.getByTestId('profile-town').fill('Manchester')
  await page
    .getByTestId('profile-booking-link')
    .fill('https://editor.example/book')
  await page.getByTestId('profile-hours-monday').fill('9:00-17:30')

  await page.getByTestId('profile-save').click()

  await expect(page.getByTestId('profile-saved-visible')).toBeVisible()

  await page.goto('/search?q=M3%202BW&radius=5')
  await expect(
    page.getByTestId('search-results').getByText(practiceName),
  ).toBeVisible()
})

test('by-appointment-only is mutually exclusive with explicit opening hours', async ({
  page,
}) => {
  await signupVerifiedAndCheckout(page)

  await page.getByTestId('profile-practice-name').fill('Hours Conflict')
  await page.getByTestId('profile-address-line1').fill('2 Editor Way')
  await page.getByTestId('profile-postcode').fill('EC2V 6AA')
  await page.getByTestId('profile-town').fill('London')
  await page
    .getByTestId('profile-booking-link')
    .fill('https://conflict.example/book')
  await page.getByTestId('profile-hours-monday').fill('9:00-17:30')
  await page.getByTestId('profile-by-appointment').check()

  // Toggling by-appointment hides the opening-hours grid in the UI; the rule
  // is still enforced by the schema, so the validator must reject the
  // (impossible-to-reach via clicks but possible via state) "both set" case.
  // Re-show the hours grid by un-checking, fill, then re-check before save.
  await page.getByTestId('profile-by-appointment').uncheck()
  await page.getByTestId('profile-hours-monday').fill('9:00-17:30')
  await page.getByTestId('profile-by-appointment').check()

  await page.getByTestId('profile-save').click()
  // The hours grid is hidden while by-appointment is checked, so the only
  // observable rejection path here is the form not flipping to "saved-visible"
  // — assert by absence.
  await expect(page.getByTestId('profile-saved-visible')).toHaveCount(0)
})

test('saving with required fields missing shows field errors and keeps the Practitioner hidden', async ({
  page,
}) => {
  await signupVerifiedAndCheckout(page)

  // Submit immediately — every required field is empty.
  await page.getByTestId('profile-save').click()

  await expect(page.getByTestId('profile-practice-name-error')).toBeVisible()
  await expect(page.getByTestId('profile-address-line1-error')).toBeVisible()
  await expect(page.getByTestId('profile-postcode-error')).toBeVisible()
  await expect(page.getByTestId('profile-town-error')).toBeVisible()
  await expect(page.getByTestId('profile-booking-link-error')).toBeVisible()

  // The success banner must NOT appear, and the practitioner must still be
  // hidden — searching the area returns no result for "Editor Optician".
  await expect(page.getByTestId('profile-saved-visible')).toHaveCount(0)

  await page.goto('/search?q=EC2V%206AA&radius=5')
  await expect(
    page.getByTestId('search-results').getByText('Editor Optician'),
  ).toHaveCount(0)
})
