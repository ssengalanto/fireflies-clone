import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Authenticate via the actual login form, then wait until the dashboard is
 * loaded. Leaves the test on `/`, ready for further interactions.
 *
 * We use the real login flow (rather than seeding `localStorage` and
 * navigating directly) because Zustand's persist hydration races Next.js's
 * dashboard-layout auth `useEffect` in dev mode — a pre-seeded store hadn't
 * finished hydrating before the layout's `router.replace('/login')` fired,
 * bouncing every test back to /login. Going through the login form is
 * ~300ms per test and is what a real user would do.
 *
 * The standalone auth spec (`auth.spec.ts`) still covers the login flow
 * in isolation; this helper just gets every *other* test to the dashboard.
 */
export async function seedAuth(
  page: Page,
  opts: { email?: string; password?: string } = {},
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(opts.email ?? 'e2e@example.com')
  await page.getByLabel(/password/i).fill(opts.password ?? 'hunter2')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 })
  // Don't return until the dashboard is actually painted — Next.js dev
  // mode + Zustand persist can briefly bounce a hard-reload back to /login
  // while hydration settles, and we want callers to start on a stable page.
  await expect(
    page.getByRole('heading', { name: /^meetings$/i, level: 1 }),
  ).toBeVisible({ timeout: 10_000 })
}
