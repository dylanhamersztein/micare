import { expect, test } from '@playwright/test'

const CANONICAL = '/p/s4l5u6g7/sophie-clarke-clarke-vision-bristol'

test('renders the public profile for a visible Practitioner', async ({
  page,
}) => {
  await page.goto(CANONICAL)

  await expect(
    page.getByRole('heading', { name: 'Sophie Clarke' }),
  ).toBeVisible()
  await expect(page.getByTestId('profile-verified')).toContainText('Verified')
  await expect(page.getByTestId('profile-photo')).toBeVisible()
  await expect(page.getByTestId('profile-practice')).toContainText(
    'Clarke Vision',
  )
  await expect(page.getByTestId('profile-practice')).toContainText('Bristol')
  await expect(page.getByTestId('profile-hours')).toContainText('Monday')
  await expect(page.getByTestId('profile-services')).toContainText(
    'Contact lens fitting',
  )
  await expect(page.getByTestId('profile-languages')).toContainText('French')
  await expect(page.getByTestId('profile-book')).toContainText(
    'Book an appointment',
  )
})

test('301-redirects a stale slug to the canonical URL', async ({ request }) => {
  const response = await request.get('/p/s4l5u6g7/some-old-slug', {
    maxRedirects: 0,
  })

  expect(response.status()).toBe(301)
  expect(response.headers()['location']).toMatch(
    /\/p\/s4l5u6g7\/sophie-clarke-clarke-vision-bristol$/,
  )
})

test('shows the not-listed page for a revoked Practitioner', async ({
  page,
}) => {
  await page.goto('/p/r4v5o6k7/daniel-reed-reed-eye-care-leeds')

  await expect(page.getByTestId('profile-not-listed')).toBeVisible()
  await expect(page.getByTestId('profile-not-listed')).toContainText(
    'not currently listed',
  )
})

test('shows the not-found page for an unknown short_id', async ({ page }) => {
  await page.goto('/p/zzzzzzzz/nobody')

  await expect(page.getByTestId('profile-not-found')).toBeVisible()
})
