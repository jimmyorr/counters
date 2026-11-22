import { test, expect } from './fixtures.js';

// iOS Home Screen web apps can launch with a page ~60px shorter than the
// screen (WebKit bug 301994). Fake that here: standalone mode, and a screen
// 59px taller than the window.
const GAP = 59;
const fakeIosStandalone = (page, gap = GAP) =>
  page.addInitScript((gap) => {
    Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
    Object.defineProperty(Screen.prototype, 'height', { get: () => window.innerHeight + gap, configurable: true });
    Object.defineProperty(Screen.prototype, 'width', { get: () => window.innerWidth, configurable: true });
  }, gap);

const navBottom = (page) =>
  page.locator('.app-nav').evaluate((el) => Math.round(el.getBoundingClientRect().bottom));

test('extends the tab bar into the missing space in an iOS Home Screen app', async ({ page }) => {
  await fakeIosStandalone(page);
  await page.goto('/');
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(await navBottom(page)).toBe(innerHeight + GAP);

  // Sheets reach the real bottom of the screen too
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('#settings-dialog').evaluate((el) => Math.round(el.getBoundingClientRect().bottom)),
    )
    .toBe(innerHeight + GAP);
});

test('leaves the layout alone outside an iOS Home Screen app', async ({ page }) => {
  await page.goto('/');
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(await navBottom(page)).toBe(innerHeight);
});

test('leaves the layout alone once WebKit reports the full height', async ({ page }) => {
  await fakeIosStandalone(page, 0);
  await page.goto('/');
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(await navBottom(page)).toBe(innerHeight);
});
