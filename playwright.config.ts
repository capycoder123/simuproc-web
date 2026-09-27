import { defineConfig, devices } from '@playwright/test';

// `npm run screenshots` runs this same suite and also writes docs/screenshots/*.png (see docShot
// in tests/e2e/helpers.ts). Set here, before the workers start, so it needs no shell syntax.
if (process.env.npm_lifecycle_event === 'screenshots') process.env.DOC_SCREENSHOTS = '1';

/**
 * Functional tests against the production build served by `vite preview` (Chromium only).
 * The web server builds first, so the tests never run against a stale dist/. Locally, a server
 * already listening on 4173 is reused as is (start it the same way, or stop it, to test the
 * current code); on CI a fresh one is always started.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    locale: 'es-CL',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
