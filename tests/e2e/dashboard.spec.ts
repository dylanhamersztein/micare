import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Sign up a fresh, verified+active Practitioner (mock mode) so the dashboard
// has a real row with a known email. Mirrors tests/e2e/checkout.spec.ts.
async function signUpFreshPractitioner(page: Page): Promise<string> {
  const suffix = String(Date.now()).slice(-6)
  const email = `slice10-${suffix}@example.co.uk`

  await page.goto('/signup')
  await page
    .locator('[data-testid="signup-form"][data-hydrated="true"]')
    .waitFor()
  await page.getByTestId('signup-full-name').fill('Dashboard Tester')
  await page.getByTestId('signup-goc-number').fill(`99-${suffix}`)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-submit').click()

  await expect(page.getByTestId('signup-verified')).toBeVisible()
  await page.getByTestId('signup-continue-to-payment').click()
  await page.waitForURL(/\/practitioner\/profile-editor/)

  return email
}

test('a Practitioner signs in via magic-link and sees all six readouts', async ({
  page,
}) => {
  const email = await signUpFreshPractitioner(page)

  // Checkout now mints a session for the account it creates (ADR-0023), so
  // the browser is signed in at this point. Drop the cookie to exercise the
  // magic-link path from a genuinely signed-out visitor.
  await page.context().clearCookies()

  // AC: unauthenticated visit to /dashboard redirects to the magic-link flow.
  await page.goto('/dashboard')
  await page.waitForURL(/\/login/)
  await expect(page.getByTestId('login-form')).toBeVisible()

  // AC: request a magic-link.
  await page
    .locator('[data-testid="login-form"][data-hydrated="true"]')
    .waitFor()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-submit').click()

  // AC: consume the magic-link (dev link triggers the /auth/callback handler).
  await page.getByTestId('dev-magic-link').click()
  await page.waitForURL(/\/dashboard/)
  // Wait for hydration so the billing/sign-out click handlers are attached.
  await page
    .locator('[data-testid="dashboard"][data-hydrated="true"]')
    .waitFor()

  // AC: the dashboard renders all six readouts.
  await expect(page.getByTestId('dashboard-verification-status')).toHaveText(
    'Verified',
  )
  await expect(page.getByTestId('dashboard-subscription-status')).toHaveText(
    'Active',
  )
  await expect(page.getByTestId('dashboard-clickthrough-count')).toHaveText('0')
  await expect(page.getByTestId('dashboard-last-verified-at')).toBeVisible()
  await expect(
    page.getByTestId('dashboard-public-profile-link'),
  ).toHaveAttribute('href', /^\/p\//)
  await expect(page.getByTestId('dashboard-billing-portal')).toBeVisible()

  // AC: the Customer Portal deep link is generated server-side (mock returns
  // an in-app URL so the e2e run stays on-origin).
  await page.getByTestId('dashboard-billing-portal').click()
  await page.waitForURL(/portal=mock/)

  // Sign-out clears the session; /dashboard guards again.
  await page.goto('/dashboard')
  await page
    .locator('[data-testid="dashboard"][data-hydrated="true"]')
    .waitFor()
  await page.getByTestId('dashboard-sign-out').click()
  await page.waitForURL(/\/login/)
  await page.goto('/dashboard')
  await page.waitForURL(/\/login/)
})

test('an invalid magic-link lands on /login with an error', async ({
  page,
}) => {
  await page.goto('/auth/callback?token=not-a-real-token')
  await page.waitForURL(/\/login/)
  await expect(page.getByTestId('login-link-error')).toBeVisible()
})

test('a returning Practitioner reaches their profile editor from the dashboard', async ({
  page,
}) => {
  await signUpFreshPractitioner(page)

  // The state a Practitioner comes back in: signed in (checkout mints the
  // session, ADR-0023) and landing on the dashboard rather than on the editor
  // link checkout handed them once.
  await page.goto('/dashboard')
  await page
    .locator('[data-testid="dashboard"][data-hydrated="true"]')
    .waitFor()

  await page.getByTestId('dashboard-profile-editor-link').click()

  await page.waitForURL(/\/practitioner\/profile-editor$/)
  await expect(page.getByTestId('profile-editor')).toBeVisible()
})
