import { expect, test } from '@playwright/test'

const logo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const project = { id: 'site', name: 'Test site', contractType: 'NEC4', isActive: true, createdAt: '2026-10-10', companyName: 'Site Company', companyEmail: 'office@example.com', companyWebsite: 'example.com', companyLogo: `data:image/png;base64,${logo.toString('base64')}`, members: [{ role: 'ADMIN', userId: 'owner', user: { id: 'owner', name: 'Owner' } }], _count: { earlyWarnings: 0, compensationEvents: 0, riskItems: 0, notices: 0 } }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aurum-auth', JSON.stringify({ state: { user: { id: 'owner', name: 'Owner', email: 'owner@example.com', role: 'ADMIN' }, token: 'test' }, version: 0 })))
  await page.route('**/api/**', (route) => route.fulfill({ json: [] }))
})

test('create a project with its company details and an uploaded logo', async ({ page }, testInfo) => {
  let saved: Record<string, unknown> | undefined
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') { saved = route.request().postDataJSON(); await route.fulfill({ status: 201, json: { ...project, ...saved } }) }
    else await route.fulfill({ json: [] })
  })
  await page.goto('/projects')
  await page.getByRole('button', { name: 'New Project' }).first().click()
  await page.getByLabel('Project Name').fill('Test site')
  await page.getByLabel('Company name').fill('Site Company')
  await page.getByLabel('Company email').fill('office@example.com')
  await page.getByLabel('Company logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo })
  await expect(page.getByAltText('Company logo preview')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('company-letterhead-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Create Project' }).click()
  await expect.poll(() => saved?.companyName).toBe('Site Company')
  expect(saved?.companyLogo).toMatch(/^data:image\/png;base64,/)
})

test('edit an existing company letterhead and remove its logo', async ({ page }, testInfo) => {
  let saved: Record<string, unknown> | undefined
  await page.route('**/api/projects/site', async (route) => {
    if (route.request().method() === 'PUT') saved = route.request().postDataJSON()
    await route.fulfill({ json: { ...project, ...saved } })
  })
  await page.route('**/api/projects/site/dashboard', route => route.fulfill({ json: { kpis: { openEWs: 0, openCEs: 0, openRisks: 0 } } }))
  await page.goto('/projects/site')
  await page.getByRole('button', { name: 'Edit Details' }).click()
  await expect(page.getByLabel('Company name')).toHaveValue('Site Company')
  await page.getByLabel('Company name').fill('Updated Company')
  await page.getByRole('button', { name: 'Remove logo' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('company-letterhead-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect.poll(() => saved?.companyName).toBe('Updated Company')
  expect(saved?.companyLogo).toBeNull()
})
