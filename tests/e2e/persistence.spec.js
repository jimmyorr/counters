import { test, expect } from './fixtures.js';

// Capacitor Preferences stores keys in localStorage under this prefix on web
const stored = (page, key) =>
  page.evaluate((k) => localStorage.getItem(`CapacitorStorage.${k}`), key);

const cards = (page) => page.locator('#counters-list-wrapper .counter-card');

test('does not persist the transient isNew flag', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-add-counter').click();
  await expect(cards(page)).toHaveCount(1);

  const [counter] = JSON.parse(await stored(page, 'counters-list'));
  expect(counter).not.toHaveProperty('isNew');
});

test('stores the theme with the other settings', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await page.locator('#setting-theme').selectOption('dark');

  const settings = JSON.parse(await stored(page, 'counters-settings'));
  expect(settings.theme).toBe('dark');
  await expect(page.locator('html')).toHaveClass(/dark-mode/);

  // Survives losing the localStorage mirror (e.g. iOS purging web view storage)
  await page.evaluate(() => localStorage.removeItem('counters-theme'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
});

test('adopts a theme saved by older versions', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('counters-theme', 'light');
      localStorage.setItem('CapacitorStorage.counters-settings', '{}');
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/light-mode/);
  await expect
    .poll(async () => JSON.parse(await stored(page, 'counters-settings')).theme)
    .toBe('light');
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#setting-theme')).toHaveValue('light');
});

test('two tabs do not overwrite each other', async ({ page, context }) => {
  await page.goto('/');
  const page2 = await context.newPage();
  await page2.goto('/');

  await page.locator('#btn-add-counter').click();
  await expect(cards(page)).toHaveCount(1);
  // The other tab picks up the change instead of keeping a stale copy
  await expect(cards(page2)).toHaveCount(1);

  await page2.locator('#btn-add-counter').click();
  await expect(cards(page2)).toHaveCount(2);
  await expect(cards(page)).toHaveCount(2);
  expect(JSON.parse(await stored(page, 'counters-list'))).toHaveLength(2);
});
