import { expect, test } from '@playwright/test'

test('shows the sign-in shell when signed out', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Sign in to Summer Plans' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible()
  await expect(page.getByText('Best for iPhone Home Screen use: stay in the app, check your email, then type the code back here.')).toBeVisible()
})
