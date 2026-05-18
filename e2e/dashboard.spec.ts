import { expect, test } from '@playwright/test'

import { seedAuth } from './utils/auth'

test.describe('dashboard', () => {
  test('lists every seed meeting on mount', async ({ page }) => {
    await seedAuth(page)

    await expect(page.getByText(/q2 planning kickoff/i)).toBeVisible()
    await expect(page.getByText(/design review — onboarding flow/i)).toBeVisible()
    await expect(page.getByText(/engineering all-hands/i)).toBeVisible()
  })

  test('opens the detail page when the user clicks a meeting and renders its transcript', async ({
    page,
  }) => {
    await seedAuth(page)

    await page.getByText(/design review — onboarding flow/i).click()

    // URL is now the meeting detail route.
    await expect(page).toHaveURL(/\/meetings\/mtg_seed_recorded$/)
    // The transcript section is rendered (the seed has a real transcript).
    await expect(
      page.getByRole('heading', {
        name: /design review — onboarding flow/i,
        level: 1,
      }),
    ).toBeVisible()
    await expect(
      page.getByText(/let's walk through the redesign/i),
    ).toBeVisible()
  })
})
