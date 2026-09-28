import { test, expect } from './fixtures.js';
import { seed, stored, counter, card } from './helpers.js';

const openSettings = async (page) => {
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
};

const cardColor = (page, id) =>
  card(page, id).evaluate((el) => getComputedStyle(el).backgroundColor);

test('switching palettes recolors preset counters but not custom ones', async ({ page }) => {
  await seed(page, {
    counters: [counter('a', 'Alpha', 0, { color: 0 }), counter('c', 'Custom', 0, { color: '#123456' })],
  });
  await page.goto('/');
  expect(await cardColor(page, 'a')).toBe('rgb(10, 84, 221)'); // bold royal blue

  await openSettings(page);
  await expect(page.locator('#setting-palette')).toHaveValue('bold');
  await page.locator('#setting-palette').selectOption('pastel');

  await expect.poll(() => cardColor(page, 'a')).toBe('rgb(147, 221, 250)'); // pastel sky
  expect(await cardColor(page, 'c')).toBe('rgb(18, 52, 86)');
  expect((await stored(page, 'counters-settings')).palette).toBe('pastel');
  // The counter itself still stores the slot, not a color
  expect((await stored(page, 'counters-list'))[0].color).toBe(0);
});

test('the setting previews the chosen palette', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  const dots = page.locator('#setting-palette-preview span');
  await expect(dots).toHaveCount(8);
  // Rainbow display order starts with the red-orange/apricot slot
  await expect(dots.first()).toHaveCSS('background-color', 'rgb(199, 53, 17)');
  await page.locator('#setting-palette').selectOption('pastel');
  await expect(dots.first()).toHaveCSS('background-color', 'rgb(253, 195, 153)');
});

test('the palette persists across reloads', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 0, { color: 4 })], settings: { palette: 'pastel' } });
  await page.goto('/');
  expect(await cardColor(page, 'a')).toBe('rgb(182, 223, 160)'); // pastel leaf green
  await page.reload();
  expect(await cardColor(page, 'a')).toBe('rgb(182, 223, 160)');
});

test('the edit dialog offers the active palette', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 0, { color: 2 })], settings: { palette: 'pastel' } });
  await page.goto('/');
  await card(page, 'a').locator('.btn-counter-edit').click();
  const swatch = page.locator('#edit-palette-container .palette-swatch[data-color-id="2"]');
  await expect(swatch).toHaveClass(/active/);
  await expect(swatch).toHaveCSS('background-color', 'rgb(253, 178, 200)'); // pastel pink
});

test('an unknown saved palette falls back to bold', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 0, { color: 0 })], settings: { palette: 'retired' } });
  await page.goto('/');
  expect(await cardColor(page, 'a')).toBe('rgb(10, 84, 221)');
});
