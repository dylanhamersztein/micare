import { expect, test } from '@playwright/test'

// Seeded in db/seed.sql: a visible Practitioner with a Booking Link, and a
// revoked one whose profile is hidden.
const VISIBLE_SHORT_ID = 's4l5u6g7'
const VISIBLE_PROFILE = '/p/s4l5u6g7/sophie-clarke-clarke-vision-bristol'
const BOOKING_URL = 'https://clarkevision.example.co.uk/book'
const REVOKED_SHORT_ID = 'r4v5o6k7'

test('302s to the Practitioner Booking Link', async ({ request }) => {
  const response = await request.get(`/go?p=${VISIBLE_SHORT_ID}`, {
    maxRedirects: 0,
  })

  expect(response.status()).toBe(302)
  expect(response.headers()['location']).toBe(BOOKING_URL)
})

test('the profile Book button points at the tracked redirect', async ({
  page,
}) => {
  await page.goto(VISIBLE_PROFILE)

  await expect(page.getByTestId('profile-book')).toHaveAttribute(
    'href',
    `/go?p=${VISIBLE_SHORT_ID}`,
  )
})

test('shows a friendly error page for an unknown short_id', async ({
  page,
}) => {
  await page.goto('/go?p=zzzzzzzz')

  await expect(page.getByTestId('go-not-found')).toBeVisible()
})

test('the friendly error page states the outcome above the heading', async ({
  page,
}) => {
  await page.goto('/go?p=zzzzzzzz')

  const notice = page.getByTestId('go-not-found')

  await expect(notice).toContainText('Unavailable')
  await expect(
    notice.getByRole('heading', { level: 1, name: 'Booking link unavailable' }),
  ).toBeVisible()
})

test('shows a friendly error page when the p parameter is missing', async ({
  page,
}) => {
  await page.goto('/go')

  await expect(page.getByTestId('go-not-found')).toBeVisible()
})

test('shows a friendly error page for a Practitioner who is not listed', async ({
  page,
}) => {
  await page.goto(`/go?p=${REVOKED_SHORT_ID}`)

  await expect(page.getByTestId('go-not-found')).toBeVisible()
})
