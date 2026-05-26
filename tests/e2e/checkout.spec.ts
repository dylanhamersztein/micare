import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function gotoSignupHydrated(page: Page): Promise<void> {
  await page.goto('/signup')
  await page
    .locator('[data-testid="signup-form"][data-hydrated="true"]')
    .waitFor()
}

test('a verified prospect can continue to payment and lands on the profile editor (mock mode)', async ({
  page,
}) => {
  await gotoSignupHydrated(page)

  // Use a fresh email AND GOC number per run so the unique constraints on
  // practitioners.email and practitioners.goc_number do not collide with the
  // persistent local DB. The reserved 99- prefix falls through to the
  // GOC_MOCK_FIXTURES default (found-active) for any unmapped number.
  const suffix = String(Date.now()).slice(-6)
  const uniqueEmail = `slice7-${suffix}@example.co.uk`
  const uniqueGoc = `99-${suffix}`
  await page.getByTestId('signup-full-name').fill('Test Optician')
  await page.getByTestId('signup-goc-number').fill(uniqueGoc)
  await page.getByTestId('signup-email').fill(uniqueEmail)
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('signup-verified')).toBeVisible()
  await page.getByTestId('signup-continue-to-payment').click()

  await page.waitForURL(/\/practitioner\/profile-editor/)
  await expect(page.getByTestId('profile-editor')).toBeVisible()
})

test('the rejected panel does not show a continue-to-payment button', async ({
  page,
}) => {
  await gotoSignupHydrated(page)

  await page.getByTestId('signup-full-name').fill('Test Optician')
  await page.getByTestId('signup-goc-number').fill('99-000002')
  await page
    .getByTestId('signup-email')
    .fill(`rejected-${Date.now()}@example.co.uk`)
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('signup-rejected')).toBeVisible()
  await expect(page.getByTestId('signup-continue-to-payment')).toHaveCount(0)
})
