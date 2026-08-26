import { expect, test } from '@playwright/test'

// The homepage is the only page both audiences land on cold, so what it has to
// prove is that each of them can leave it by the door meant for them: a
// consumer through a search that reaches real results, a Practitioner prospect
// through an offer that names its price.

test('the homepage states the consumer proposition', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('home-consumer-promise')).toContainText(
    'General Optical Council',
  )
})

test('the homepage states the Practitioner proposition, price included', async ({
  page,
}) => {
  await page.goto('/')

  const offer = page.getByTestId('home-practitioner-offer')
  await expect(offer).toBeVisible()
  await expect(page.getByTestId('home-practitioner-price')).toContainText('£29')
  await expect(offer).toContainText('Click-through')
})

test('a consumer searches from the homepage and reaches real results', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('[data-testid="home-search-form"][data-hydrated="true"]')
    .waitFor()

  await page.getByTestId('home-search-query').fill('EC2V 6AA')
  await page.getByTestId('home-search-radius').getByText('10 miles').click()
  await page.getByTestId('home-search-submit').click()

  await page.waitForURL(/\/search\?.*radius=10/)

  const results = page.getByTestId('search-results').locator('li')
  await expect(results).toHaveCount(2)
  await expect(results.nth(0)).toContainText('Jane Smith')
})

test('a Practitioner prospect reaches signup from the homepage offer', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByTestId('home-practitioner-cta').click()

  await page.waitForURL(/\/signup/)
  await expect(page.getByTestId('signup-form')).toBeVisible()
})

test('the homepage no longer dumps every visible Practitioner on the page', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByTestId('practitioner-count')).toHaveCount(0)
  await expect(page.getByText('Jane Smith')).toHaveCount(0)
})
