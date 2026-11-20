import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Browser tests run against the production build, served by `vite preview` under /whimigo/.
 * `npm run e2e` builds first. WebKit is not Safari: it runs the smoke test only.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // A second build, for the tests that deploy a newer version under a running page.
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  // Headless browsers draw WebGL in software, and the canvas is 2752 x 2064 or more.
  workers: process.env['CI'] ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/whimigo/`,
    hasTouch: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/whimigo/`,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium-tablet-4x3',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1376, height: 1032 },
        hasTouch: true,
      },
    },
    {
      name: 'chromium-small-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1133, height: 744 }, hasTouch: true },
    },
    {
      name: 'chromium-tablet-16x10',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, hasTouch: true },
    },
    {
      name: 'webkit-smoke',
      grep: /@smoke/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
  ],
});
