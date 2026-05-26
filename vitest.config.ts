import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'tests/e2e/**',
            'tests/integration/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'tests/e2e/**',
            'tests/integration/setup.ts',
          ],
          setupFiles: ['tests/integration/setup.ts'],
          testTimeout: 20_000,
          hookTimeout: 20_000,
          // Integration tests all share the local Compose database; running
          // their files in parallel races on row clean-up between tests that
          // happen to touch the same reserved GOC number or email.
          fileParallelism: false,
        },
      },
    ],
  },
})
