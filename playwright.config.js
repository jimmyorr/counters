import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Tests run against a dedicated Vite server so they don't collide with other
// dev servers. Set BASE_URL to test an already-running server instead.
const PORT = 5199;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}/`;
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
  .find((candidate) => fs.existsSync(candidate));

const browserLaunchUse = process.env.CHROME_PATH
  ? { launchOptions: { executablePath: process.env.CHROME_PATH } }
  : systemChromium
    ? { launchOptions: { executablePath: systemChromium } }
    : { channel: 'chrome' };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // Single worker so runs stay cool on laptops and don't contend for CPU/GPU
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    // Use the locally installed Chrome/Chromium; no browser download needed
    ...browserLaunchUse,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], ...browserLaunchUse },
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
