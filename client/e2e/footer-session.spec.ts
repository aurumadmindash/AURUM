import { expect, test } from '@playwright/test'

for (const width of [320, 390, 1280]) {
  test(`footer contact rows fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/about')
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()
    const email = footer.getByRole('link', { name: 'enquiries@aurumite.com', exact: true })
    const phone = footer.getByRole('link', { name: '+44 7873 933154', exact: true })
    await expect(email).toHaveAttribute('href', 'mailto:enquiries@aurumite.com')
    await expect(phone).toHaveAttribute('href', 'tel:+447873933154')
    const a = await email.boundingBox(), b = await phone.boundingBox()
    expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y)
    expect(await email.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('footer.png'), fullPage: true })
  })
}

test('old persistent credentials and expired tab sessions are removed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('aurum-auth', JSON.stringify({ state: { token: 'old-token' }, version: 0 }))
    const token = `e30.${btoa(JSON.stringify({ exp: 1 }))}.signature`
    sessionStorage.setItem('aurum-auth', JSON.stringify({ state: { token, user: { id: 'old' } }, version: 0 }))
  })
  await page.goto('/jobs')
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('aurum-auth'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('aurum-auth'))).toBeNull()
})
