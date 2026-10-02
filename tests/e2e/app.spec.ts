import { test, expect } from '@playwright/test'

test.describe('Animovi E2E', () => {
  test('should load app and display avatar scene', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="avatar-scene"]')).toBeVisible()
  })

  test('should display settings panel', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.locator('#smoothing')).toBeVisible()
    await expect(page.getByText('Face Tracking')).toBeVisible()
    await expect(page.getByText('Pose Tracking')).toBeVisible()
    await expect(page.getByText('Hand Tracking')).toBeVisible()
  })

  test('should respond to settings changes', async ({ page }) => {
    await page.goto('/')

    await page.locator('#smoothing').fill('0.8')

    await expect(page.getByText('Smoothing: 0.80')).toBeVisible()
  })

  test('should toggle tracking checkboxes', async ({ page }) => {
    await page.goto('/')

    const faceCheckbox = page.getByLabel('Face Tracking')
    await expect(faceCheckbox).toBeChecked()

    await faceCheckbox.click()

    await expect(faceCheckbox).not.toBeChecked()
  })
})
