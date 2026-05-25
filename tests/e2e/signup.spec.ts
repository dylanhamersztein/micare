import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// The dev server runs with GOC_MOCK unset (defaults true), so these reserved
// numbers map to deterministic GOC_MOCK_FIXTURES outcomes.
async function gotoHydrated(page: Page): Promise<void> {
  await page.goto('/signup')
  // Wait until React has attached its onSubmit handler before any input —
  // without this the click can race the native form submit and reload the
  // page with state wiped.
  await page
    .locator('[data-testid="signup-form"][data-hydrated="true"]')
    .waitFor()
}

async function fillAndSubmit(page: Page, gocNumber: string): Promise<void> {
  await gotoHydrated(page)
  await page.getByTestId('signup-full-name').fill('Test Optician')
  await page.getByTestId('signup-goc-number').fill(gocNumber)
  await page.getByTestId('signup-email').fill('test.optician@example.co.uk')
  await page.getByTestId('signup-submit').click()
}

test('a verified GOC number shows the verified confirmation panel', async ({
  page,
}) => {
  await fillAndSubmit(page, '99-000001')

  await expect(page.getByTestId('signup-verified')).toBeVisible()
})

test('a GOC number not on the register shows the rejected panel', async ({
  page,
}) => {
  await fillAndSubmit(page, '99-000002')

  await expect(page.getByTestId('signup-rejected')).toBeVisible()
  await expect(page.getByTestId('signup-rejected')).toContainText('no charge')
})

test('an unreadable register result shows the pending panel', async ({
  page,
}) => {
  await fillAndSubmit(page, '99-000003')

  await expect(page.getByTestId('signup-pending')).toBeVisible()
  await expect(page.getByTestId('signup-pending')).toContainText('follow up')
})

test('an invalid GOC number is rejected before submitting', async ({
  page,
}) => {
  await gotoHydrated(page)
  await page.getByTestId('signup-full-name').fill('Test Optician')
  await page.getByTestId('signup-goc-number').fill('not-a-number')
  await page.getByTestId('signup-email').fill('test.optician@example.co.uk')
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('signup-invalid')).toBeVisible()
})
