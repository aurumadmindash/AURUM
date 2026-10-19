import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`images, video and fonts use local hosting on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    const external: string[] = [], errors: string[] = []
    page.on('request', request => {
      if (request.url().startsWith('http') && new URL(request.url()).origin !== 'http://127.0.0.1:4175') external.push(request.url())
    })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await page.getByRole('dialog').getByRole('button', { name: 'Accept', exact: true }).click()
    const video = page.locator('video')
    await expect(video.locator('source')).toHaveAttribute('src', '/landing/aurum-site-video.mp4')
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(0)
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2)
    for (const image of await page.locator('#services img').all()) {
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
      expect(await image.getAttribute('src')).toMatch(/^\/landing\//)
    }
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.fonts.check('400 16px Inter') && document.fonts.check('600 20px Montserrat'))).toBe(true)
    await expect(page.locator('footer').getByRole('link', { name: '+44 7873 933154' })).toHaveAttribute('href', 'tel:+447873933154')
    await page.locator('#services').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('local-media.png') })
    await page.goto('/about')
    await expect(page.getByRole('link', { name: 'Call +44 7873 933154' })).toHaveAttribute('href', 'tel:+447873933154')
    await page.goto('/request-quote')
    await expect(page.locator('footer').getByRole('link', { name: '+44 7873 933154' })).toBeVisible()
    expect(external).toEqual([])
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
