import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    launchOptions: process.env.PLAYWRIGHT_BROWSER_PATH
      ? { executablePath: process.env.PLAYWRIGHT_BROWSER_PATH } : {},
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
})
