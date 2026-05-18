import { expect, test } from '@playwright/test'

test.describe('auth gate (soft login)', () => {
  test('redirects an unauthenticated visitor from / to /login', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('heading', { name: /sign in to fireflies/i }),
    ).toBeVisible()
  })

  test('signs in with any valid email + a 6+ char password and lands on the dashboard', async ({
    page,
  }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('e2e@example.com')
    await page.getByLabel(/password/i).fill('hunter2')
    await page.getByRole('button', { name: /sign in/i }).click()

    // The login fetcher resolves → setUser → router.replace('/').
    await expect(page).toHaveURL(/\/$/)
    // Seed meeting title is the cheap signal that the dashboard mounted.
    await expect(page.getByText(/q2 planning kickoff/i)).toBeVisible()
  })

  test('rejects a too-short password client-side (zod) without firing a network call', async ({
    page,
  }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('e2e@example.com')
    await page.getByLabel(/password/i).fill('123') // < 6 chars
    await page.getByRole('button', { name: /sign in/i }).click()

    // Stays on /login; zod surfaces the FormMessage.
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByText(/password must be at least 6 characters/i),
    ).toBeVisible()
  })
})
