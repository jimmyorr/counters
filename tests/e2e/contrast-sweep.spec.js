import { test, expect } from './fixtures.js';
import { seed, counter, card, contrast, PALETTES, presets } from './helpers.js';

// Every surface that draws with a counter's color, checked in both themes for
// every palette, so a new combination can't fail unnoticed. Text needs 4.5:1,
// and large text (24px+, like the card value) and icons need 3:1 (WCAG 1.4.3
// and 1.4.11).

const THEMES = ['light', 'dark'];
const TEXT = 4.5;
const LARGE_TEXT = 3;
const ICON = 3;

// Collects every shortfall so one run reports them all
const checker = () => {
  const failures = [];
  const check = async (what, locator, min, prop) => {
    const ratio = await contrast(locator, prop);
    if (ratio < min) failures.push(`${what}: ${ratio.toFixed(2)} < ${min}`);
  };
  return { failures, check };
};

const sweep = async (page, counters, { check }) => {
  for (const { id } of counters) {
    const c = card(page, id);
    await check(`${id} card label`, c.locator('.counter-label'), TEXT);
    await check(`${id} card value`, c.locator('.value-display'), LARGE_TEXT);
    await check(`${id} card minus`, c.locator('.card-direct-zone-minus'), ICON);
    await check(`${id} card plus`, c.locator('.card-direct-zone-plus'), ICON);

    await c.locator('.card-value-body').click();
    await expect(page.locator('#calc-dialog-title')).toBeVisible();
    await check(`${id} calculator title`, page.locator('#calc-dialog-title'), TEXT);
    await check(`${id} calculator active op`, page.locator('#calc-op-plus'), ICON);
    await check(`${id} calculator submit`, page.locator('#calc-btn-submit'), TEXT);
    await page.keyboard.press('Escape');
    await expect(page.locator('#calculator-dialog')).toBeHidden();
  }

  // Each counter takes the lead in turn
  for (const { id } of counters) {
    const list = counters.map((c) => ({ ...c, value: c.id === id ? 1 : 0 }));
    await page.evaluate((l) => localStorage.setItem('CapacitorStorage.counters-list', JSON.stringify(l)), list);
    await page.reload();
    await expect(page.locator('#header-leader-text')).toHaveText(list.find((c) => c.id === id).label);
    await check(`${id} leader arrow`, page.locator('.leader-icon'), ICON);
    await check(`${id} leader name`, page.locator('#header-leader-text'), TEXT);
  }
};

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
    });

    for (const palette of PALETTES) {
      test(`${palette}: counter colors stay readable everywhere`, async ({ page }) => {
        const counters = presets();
        await seed(page, { counters, settings: { palette, theme } });
        await page.goto('/');
        const c = checker();
        await sweep(page, counters, c);
        expect(c.failures).toEqual([]);
      });
    }

    test('custom colors stay readable everywhere', async ({ page }) => {
      const hexes = ['#ffffff', '#000000', '#f5f0c8', '#777777', '#ff0000', '#00ffff', '#202040', '#c8f5e0'];
      const counters = hexes.map((color, i) => counter(`c${i}`, color, 0, { color }));
      await seed(page, { counters, settings: { theme } });
      await page.goto('/');
      const c = checker();
      await sweep(page, counters, c);
      expect(c.failures).toEqual([]);
    });
  });
}
