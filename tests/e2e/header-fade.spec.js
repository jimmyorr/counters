import { test, expect } from './fixtures.js';
import { seed, counter } from './helpers.js';

test('Counters-only header controls fade out off-tab and fade back in on Counters', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Allison', 5)] });
  await page.goto('/');

  const leader = page.locator('#header-leader-container');
  const historyBtn = page.locator('#btn-open-history');
  const addBtn = page.locator('#btn-add-counter');
  const menuBtn = page.locator('#btn-open-options');

  for (const el of [leader, historyBtn, addBtn, menuBtn]) {
    await expect(el).toHaveCSS('opacity', '1');
    await expect(el).toHaveJSProperty('inert', false);
  }

  for (const tab of ['dice', 'timer', 'picker']) {
    await page.locator(`[data-tab-btn="${tab}"]`).click();
    await expect(page.locator('.app-header')).toHaveAttribute('data-active-tab', tab);
    for (const el of [leader, historyBtn, addBtn]) {
      await expect(el).toHaveCSS('opacity', '0');
      await expect(el).toHaveCSS('pointer-events', 'none');
      await expect(el).toHaveJSProperty('inert', true);
    }
    await expect(menuBtn).toHaveCSS('opacity', '1');
    await expect(menuBtn).toHaveJSProperty('inert', false);
  }

  await page.locator('[data-tab-btn="counters"]').click();
  await expect(page.locator('.app-header')).toHaveAttribute('data-active-tab', 'counters');
  for (const el of [leader, historyBtn, addBtn, menuBtn]) {
    await expect(el).toHaveCSS('opacity', '1');
    await expect(el).toHaveJSProperty('inert', false);
  }
});
