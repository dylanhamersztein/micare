import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Client } from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres'

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// The 24h suppression cache is keyed on the GOC number and outlives a test
// run, so a number this suite counts attempts for starts from nothing.
async function forgetVerification(gocNumber: string): Promise<void> {
  await withDb(async (client) => {
    // verifications cascades from practitioners, so the pending row filed by
    // signup goes first.
    await client.query(
      'delete from public.practitioners where goc_number = $1',
      [gocNumber],
    )
    await client.query(
      'delete from public.verifications where goc_number = $1',
      [gocNumber],
    )
  })
}

async function attemptCount(gocNumber: string): Promise<number> {
  return withDb(async (client) => {
    const { rows } = await client.query<{ count: string }>(
      'select count(*) as count from public.verifications where goc_number = $1',
      [gocNumber],
    )
    return Number(rows[0].count)
  })
}

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

// Issue #68: 99-000005 is on the mock register and active, but it belongs to
// Ethan Belson. fillAndSubmit signs up as "Test Optician", so the number
// checks out and the name does not — which is a rejection, not a pass.
test('a live registration claimed under the wrong name is rejected', async ({
  page,
}) => {
  await fillAndSubmit(page, '99-000005')

  await expect(page.getByTestId('signup-rejected')).toBeVisible()
  await expect(page.getByTestId('signup-rejected')).toContainText(
    'first and last name',
  )
})

test('an unreadable register result shows the pending panel', async ({
  page,
}) => {
  await fillAndSubmit(page, '99-000003')

  await expect(page.getByTestId('signup-pending')).toBeVisible()
  // ADR-0019: the pending copy names the operator re-run and promises no
  // background retry, because there is none.
  await expect(page.getByTestId('signup-pending')).toContainText(
    'Nothing retries in the background',
  )
})

test("the pending panel's retry button really re-runs the check", async ({
  page,
}) => {
  // 99-000004 (register unreachable) is this suite's alone; the pending
  // display test above uses 99-000003.
  const gocNumber = '99-000004'
  await forgetVerification(gocNumber)

  await fillAndSubmit(page, gocNumber)
  await expect(page.getByTestId('signup-pending')).toBeVisible()
  expect(await attemptCount(gocNumber)).toBe(1)

  await page.getByTestId('signup-retry').click()

  // A second row is a second attempt. Before issue #67 the 24h cache replayed
  // the first one and no row was written, so the button did nothing at all.
  await expect.poll(() => attemptCount(gocNumber)).toBe(2)
  await expect(page.getByTestId('signup-pending')).toBeVisible()

  // Cleaned here rather than in an afterAll: Playwright runs afterAll once per
  // worker, so a file-level hook can delete these rows while this test is
  // still counting them in another worker.
  await forgetVerification(gocNumber)
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
