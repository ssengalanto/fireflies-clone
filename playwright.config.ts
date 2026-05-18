import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3001)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Each spec file runs in its own worker. Tests within a file run
  // sequentially by default — important here because they share a single
  // dev-server process whose `lib/server/meetingStore.ts` is an
  // in-memory Map. Read-only tests don't care; the create-meeting spec
  // uses unique titles to stay parallel-safe.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    // Re-use a server already running locally; in CI always start fresh.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Empty strings disable the HTTP Basic Auth gate in middleware.ts
    // (the gate treats either value being empty/unset as "disabled"). This
    // keeps e2e specs from needing httpCredentials regardless of whether
    // the developer has the gate enabled locally via .env.
    env: {
      BASIC_AUTH_USER: '',
      BASIC_AUTH_PASSWORD: '',
    },
  },
})
