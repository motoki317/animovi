import { test, expect } from '@playwright/test'

test.describe('VRM-Tuber E2E', () => {
  test('should load app and display avatar scene', async ({ page }) => {
    await page.goto('/')

    // Avatar scene should be visible
    const avatarScene = page.locator('[data-testid="avatar-scene"]')
    await expect(avatarScene).toBeVisible()
  })

  test('should display settings panel', async ({ page }) => {
    await page.goto('/')

    // Settings header should be visible
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Smoothing slider should be present
    await expect(page.locator('#smoothing')).toBeVisible()

    // Tracking checkboxes should be present
    await expect(page.getByText('Face Tracking')).toBeVisible()
    await expect(page.getByText('Pose Tracking')).toBeVisible()
    await expect(page.getByText('Hand Tracking')).toBeVisible()
  })

  test('should respond to settings changes', async ({ page }) => {
    await page.goto('/')

    // Get initial smoothing value
    const slider = page.locator('#smoothing')
    const initialValue = await slider.inputValue()

    // Change smoothing value
    await slider.fill('0.8')

    // Verify the displayed value updated
    await expect(page.getByText('Smoothing: 0.80')).toBeVisible()
  })

  test('should toggle tracking checkboxes', async ({ page }) => {
    await page.goto('/')

    // Find face tracking checkbox
    const faceCheckbox = page.locator('input[type="checkbox"]').first()

    // Should be checked by default
    await expect(faceCheckbox).toBeChecked()

    // Click to uncheck
    await faceCheckbox.click()

    // Should now be unchecked
    await expect(faceCheckbox).not.toBeChecked()
  })
})
