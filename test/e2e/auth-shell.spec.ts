import { expect, test } from '@playwright/test'

test('shows the sign-in shell when signed out', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Sign in to Summer Plans' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send sign-in link' })).toBeVisible()
  await expect(page.getByText('Open the link from your email on this device to finish signing in.')).toBeVisible()
})
