import { expect, test } from '@playwright/test'

test('search by postcode + radius lists visible Practitioners ordered by distance', async ({
  page,
}) => {
  await page.goto('/search?q=EC2V%206AA&radius=5')

  await expect(
    page.getByRole('heading', { name: 'Find a Practitioner' }),
  ).toBeVisible()

  const results = page.getByTestId('search-results').locator('li')
  await expect(results).toHaveCount(2)

  // Jane Smith (Smith Optical, Cheapside) is co-located with EC2V 6AA, so
  // she's first. Priya Patel (City Eyes, Old Street) follows at ~0.9 mi.
  await expect(results.nth(0)).toContainText('Jane Smith')
  await expect(results.nth(0)).toContainText('Smith Optical')
  await expect(results.nth(1)).toContainText('Priya Patel')
  await expect(results.nth(1)).toContainText('City Eyes')

  // Hidden / unverified / unsubscribed Practitioners must not appear.
  await expect(page.getByText('John Doe')).toHaveCount(0)
  await expect(page.getByText('Hidden Practitioner')).toHaveCount(0)
})

test('search by city name resolves through the places lookup', async ({
  page,
}) => {
  await page.goto('/search?q=Norwich&radius=5')

  const results = page.getByTestId('search-results').locator('li')
  await expect(results).toHaveCount(1)
  await expect(results.nth(0)).toContainText('Eleanor Hughes')
  await expect(results.nth(0)).toContainText('Castle Eye Care')
  await expect(results.nth(0)).toContainText('Norwich')
})

test('search shows the no-location message for an unknown postcode', async ({
  page,
}) => {
  await page.goto('/search?q=ZZ1%201ZZ&radius=5')
  await expect(page.getByTestId('search-no-location')).toBeVisible()
})

test('search shows the no-location message for an unresolvable city name', async ({
  page,
}) => {
  await page.goto('/search?q=Atlantisburg&radius=5')
  await expect(page.getByTestId('search-no-location')).toBeVisible()
})
