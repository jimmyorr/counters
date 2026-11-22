import { test, expect } from './fixtures.js';

// iOS Home Screen web apps can launch with a page ~60px shorter than the
// screen (WebKit bug 301994). WebKit doesn't paint below the page there, so
// nothing may extend past it. Fake the bug: standalone mode, and a screen 59px
// taller than the window.
const GAP = 59;
const fakeIosStandalone = (page, gap = GAP) =>
  page.addInitScript((gap) => {
    Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
    Object.defineProperty(Screen.prototype, 'height', { get: () => window.innerHeight + gap, configurable: true });
    Object.defineProperty(Screen.prototype, 'width', { get: () => window.innerWidth, configurable: true });
  }, gap);

const bottomOf = (locator) =>
  locator.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));

test('keeps the tab bar and its labels on the page in an iOS Home Screen app', async ({ page }) => {
  await fakeIosStandalone(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('style', /--ios-pwa-gap: 59px/);
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(await bottomOf(page.locator('.app-nav'))).toBe(innerHeight);
  for (const label of await page.locator('.nav-text').all()) {
    await expect(label).toBeInViewport();
  }

  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect.poll(() => bottomOf(page.locator('#settings-dialog'))).toBe(innerHeight);
});

test('does not measure a gap outside an iOS Home Screen app', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--ios-pwa-gap'))).toBe('');
});

test('measures no gap once WebKit reports the full height', async ({ page }) => {
  await fakeIosStandalone(page, 0);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('style', /--ios-pwa-gap: 0px/);
});
