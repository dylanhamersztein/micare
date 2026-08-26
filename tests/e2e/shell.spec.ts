import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

// The shell is the only part of the app every page shares, so what it has to
// prove is that a visitor can get where they are going without typing a URL —
// which is exactly what they had to do before this slice.

// A fresh, verified + active Practitioner in mock mode, signed in through the
// magic-link flow. Mirrors tests/e2e/dashboard.spec.ts.
async function signInFreshPractitioner(page: Page): Promise<void> {
  const suffix = String(Date.now()).slice(-6)
  const email = `slice19-${suffix}@example.co.uk`

  await page.goto('/signup')
  await page
    .locator('[data-testid="signup-form"][data-hydrated="true"]')
    .waitFor()
  await page.getByTestId('signup-full-name').fill('Shell Tester')
  await page.getByTestId('signup-goc-number').fill(`98-${suffix}`)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-submit').click()
  await expect(page.getByTestId('signup-verified')).toBeVisible()
  await page.getByTestId('signup-continue-to-payment').click()
  await page.waitForURL(/\/practitioner\/profile-editor/)

  await page.goto('/login')
  await page
    .locator('[data-testid="login-form"][data-hydrated="true"]')
    .waitFor()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-submit').click()
  await page.getByTestId('dev-magic-link').click()
  await page.waitForURL(/\/dashboard/)
}

test('a consumer reaches search from the homepage using only the header', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByTestId('header-search').click()

  await page.waitForURL(/\/search/)
  await expect(
    page.getByRole('heading', { name: 'Find a Practitioner' }),
  ).toBeVisible()
})

test('a Practitioner prospect reaches signup from the homepage using only the header', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByTestId('header-signup').click()

  await page.waitForURL(/\/signup/)
  await expect(page.getByTestId('signup-form')).toBeVisible()
})

test('the header offers a returning Practitioner the way back in', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByTestId('header-signin').click()

  await page.waitForURL(/\/login/)
  await expect(page.getByTestId('login-form')).toBeVisible()
})

test('the shell is on every page, and states the terms of trade', async ({
  page,
}) => {
  for (const path of ['/', '/search', '/signup', '/login']) {
    await page.goto(path)

    await expect(page.getByTestId('site-header')).toBeVisible()
    await expect(page.getByTestId('site-footer')).toContainText(
      'Nothing on MiCare is a paid placement',
    )
  }
})

test('the document describes MiCare rather than the scaffold', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/MiCare/)
  await expect(page).not.toHaveTitle(/TanStack/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /paid placement/,
  )
})

test('the header swaps sign-in for a dashboard once a Practitioner is signed in', async ({
  page,
}) => {
  await signInFreshPractitioner(page)

  // AC: the signed-in Practitioner has a route to their dashboard from the
  // header, on a page that is not the dashboard.
  await page.goto('/search')
  await expect(page.getByTestId('header-dashboard')).toHaveAttribute(
    'href',
    '/dashboard',
  )
  await expect(page.getByTestId('header-signin')).toHaveCount(0)

  await page.getByTestId('header-dashboard').click()
  await page.waitForURL(/\/dashboard/)

  // And signing out puts the signed-out header back, without a reload.
  await page
    .locator('[data-testid="dashboard"][data-hydrated="true"]')
    .waitFor()
  await page.getByTestId('dashboard-sign-out').click()
  await page.waitForURL(/\/login/)
  await expect(page.getByTestId('header-signin')).toBeVisible()
  await expect(page.getByTestId('header-dashboard')).toHaveCount(0)
})
