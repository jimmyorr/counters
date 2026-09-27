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
