import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF ?? 'local-dev',
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'local-dev-service-role-key',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:54322/postgres',
      VITE_STRIPE_MOCK: process.env.VITE_STRIPE_MOCK ?? 'true',
      GOC_MOCK: process.env.GOC_MOCK ?? 'true',
      PHOTO_CHECK_MOCK: process.env.PHOTO_CHECK_MOCK ?? 'true',
      SUPABASE_STORAGE_MOCK: process.env.SUPABASE_STORAGE_MOCK ?? 'true',
      AUTH_MOCK: process.env.AUTH_MOCK ?? 'true',
      AUTH_SESSION_SECRET:
        process.env.AUTH_SESSION_SECRET ??
        'e2e-session-secret-not-secret-0123456789abcdef',
    },
  },
})
