import { defineConfig, devices } from '@playwright/test';

// Tests run against a dedicated Vite server so they don't collide with other
// dev servers. Set BASE_URL to test an already-running server instead.
const PORT = 5199;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    // Use the locally installed Chrome; no browser download needed
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
