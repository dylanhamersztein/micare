import { expect, test } from '@playwright/test'

// Edinburgh: a real postcode postcodes.io resolves, with no seeded Practitioner
// anywhere near it — so /search lands on the empty-results state that carries
// the Notify-Me CTA.
const EMPTY_SEARCH = '/search?q=EH1%201YZ&radius=5'

function uniqueEmail(): string {
  return `notify-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.co.uk`
}

test('empty search results offer Notify-Me, and the emailed link confirms it', async ({
  page,
}) => {
  await page.goto(EMPTY_SEARCH)

  await expect(page.getByTestId('search-empty')).toBeVisible()
  // Wait until React has attached its onSubmit handler before typing —
  // without this the click can race the native form submit and reload the
  // page with the email wiped (same guard as /signup).
  await page
    .locator('[data-testid="notify-form"][data-hydrated="true"]')
    .waitFor()

  // The postcode just searched is carried into the form — the consumer should
  // not have to type it twice.
  await expect(page.getByTestId('notify-postcode')).toHaveValue('EH1 1YZ')

  await page.getByTestId('notify-email').fill(uniqueEmail())
  await page.getByTestId('notify-submit').click()

  await expect(page.getByTestId('notify-submitted')).toBeVisible()

  // ALERT_MOCK is on in e2e, so the confirmation link is rendered rather than
  // emailed (the same affordance the mock login flow uses).
  await page.getByTestId('notify-dev-confirm').click()
  await expect(page.getByTestId('notify-confirmed')).toBeVisible()
})

test('a tampered confirmation link confirms nothing', async ({ page }) => {
  await page.goto('/notify-me/confirm?token=not-a-real-token')
  await expect(page.getByTestId('notify-invalid')).toBeVisible()
})

test('an unsubscribe link with a bad token says so plainly', async ({
  page,
}) => {
  await page.goto('/notify-me/unsubscribe?token=not-a-real-token')
  await expect(page.getByTestId('notify-invalid')).toBeVisible()
})
