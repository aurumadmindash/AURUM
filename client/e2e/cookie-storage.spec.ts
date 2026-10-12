import { expect, test } from '@playwright/test'

test('blocks optional media until consent and remembers withdrawal', async ({ page }) => {
  const mediaRequests: string[] = []
  await page.route('https://videos.pexels.com/**', route => { mediaRequests.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }) })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Enable optional background video' })).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
  expect(mediaRequests).toHaveLength(0)
  expect(await page.evaluate(() => localStorage.getItem('aurum-media-preference'))).toBeNull()
  await page.getByRole('button', { name: 'Enable optional background video' }).click()
  await expect(page.locator('video')).toHaveCount(1)
  await expect.poll(() => mediaRequests.length).toBeGreaterThan(0)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('aurum-media-preference')!))
  expect(stored.enabled).toBe(true)
  expect(stored.expiresAt).toBeGreaterThan(Date.now())
  await page.goto('/legal/cookies')
  await expect(page.getByRole('heading', { name: 'Cookie and Browser Storage Notice', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('External video is enabled.')
  await page.getByRole('button', { name: 'Disable external video' }).click()
  await expect(page.getByRole('status')).toHaveText('External video is disabled.')
  const before = mediaRequests.length
  await page.goto('/')
  await expect(page.locator('video')).toHaveCount(0)
  expect(mediaRequests).toHaveLength(before)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aurum-media-preference')!).enabled)).toBe(false)
})

test('expired or malformed media choices never enable external video', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aurum-media-preference', JSON.stringify({ version: 1, enabled: true, expiresAt: Date.now() - 1000 })))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Enable optional background video' })).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('aurum-media-preference'))).toBeNull()
})

test('sign-out deletes the account entry and its token', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('aurum-auth')) localStorage.setItem('aurum-auth', JSON.stringify({ state: { token: 'test-login-token', user: { id: 'admin', name: 'Aurum Admin', email: 'admin@example.com', role: 'ADMIN' } }, version: 0 }))
  })
  await page.route('**/api/**', route => route.fulfill({ json: [] }))
  await page.goto('/jobs')
  await expect(page.getByRole('heading', { name: 'Aurum Jobs' })).toBeVisible()
  await page.getByTitle('Sign out', { exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('aurum-auth'))).toBeNull()
})

test('cookie inventory, privacy disclosures and new prices are readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/legal/cookies')
  await expect(page.getByRole('heading', { name: 'Cookie and Browser Storage Notice', exact: true })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: '__cf_bm — Cloudflare / Pexels', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable external video' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/legal/privacy')
  await expect(page.getByRole('heading', { name: 'External images, fonts and video' })).toBeVisible()
  await page.goto('/#pricing')
  const pricing = page.locator('#pricing')
  for (const title of ['Quantity take-offs', 'Tender estimate', 'Full tender support', 'Monthly commercial support']) await expect(pricing.getByRole('heading', { name: title, exact: true })).toBeVisible()
  for (const amount of ['£150', '£450', '£550', '£800/month']) await expect(pricing.getByText(amount, { exact: true })).toBeVisible()
})
