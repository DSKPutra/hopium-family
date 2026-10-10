import { defineConfig, devices } from '@playwright/test';

/** Web e2e against the static export (npm run export:web first). */
export default defineConfig({
  testDir: './e2e/playwright',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [
    { name: 'mobile-web', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop-web',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'node scripts/serve-dist.js 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
