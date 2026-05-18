import { expect, test } from '@playwright/test'

import { seedAuth } from './utils/auth'

test.describe('new meeting modal', () => {
  test('creates a meeting via the DateTimePicker and surfaces it in the list', async ({
    page,
  }) => {
    await seedAuth(page)

    // Unique title per run so the in-memory store doesn't accumulate
    // false positives across reruns / parallel workers.
    const title = `E2E meeting ${Date.now()}`

    await page.getByRole('button', { name: /new meeting/i }).first().click()

    const dialog = page.getByRole('dialog', { name: /new meeting/i })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/title/i).fill(title)
    // Pre-existing form quirk: useFieldArray with `string[]` doesn't render
    // the default participant input; the user has to click "Add participant"
    // to materialise one. Mirror that flow here.
    await dialog.getByRole('button', { name: /add participant/i }).click()
    await dialog.getByPlaceholder('name@example.com').fill('e2e@example.com')

    // Open the custom DateTimePicker popover.
    const trigger = dialog.getByRole('button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ })
    await trigger.click()

    const picker = page.getByRole('dialog', { name: /date and time picker/i })
    await expect(picker).toBeVisible()

    // Jump forward one month before picking, so the day we click is
    // unambiguously in the future (the picker disables days before today
    // — see `minDate` on the trigger).
    await picker.getByRole('button', { name: /next month/i }).click()
    const dayButton = picker.getByRole('button', { name: /\b15,\s+\d{4}$/ })
    await dayButton.click()
    await expect(dayButton).toHaveAttribute('aria-pressed', 'true')

    // Close the picker by clicking outside (the title input is safe).
    // Meridiem and hour/minute editing are covered by the Jest unit tests
    // for <DateTimePicker /> — e2e only needs to verify the calendar grid
    // wires up to a form submission end-to-end.
    await dialog.getByLabel(/title/i).click()
    await expect(picker).not.toBeVisible()

    await dialog.getByRole('button', { name: /create meeting/i }).click()

    // Dialog closes → new meeting appears on the dashboard.
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(title)).toBeVisible()
  })
})
