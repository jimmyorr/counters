import { test, expect } from './fixtures.js';

const result = (page) => page.locator('#dice-result-card');
const total = (page) => page.locator('#dice-result-total');
const roll = (page) => page.locator('#btn-roll-action');
const dieType = (page, sides) => page.locator(`.dice-type-btn[data-type="${sides}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-tab-btn="dice"]').click();
});

// The accent border means "this result is for the dice selected now"
test('highlights a result only while it matches the selected dice', async ({ page }) => {
  await expect(result(page)).not.toHaveClass(/rolled/);

  await roll(page).click();
  await expect(total(page)).toHaveText(/^[1-6]$/);
  await expect(result(page)).toHaveClass(/rolled/);
  await expect(result(page)).toHaveCSS('transform', 'none'); // no enlargement

  await dieType(page, 20).click();
  await expect(result(page)).not.toHaveClass(/rolled/);
  await dieType(page, 6).click();
  await expect(result(page)).toHaveClass(/rolled/);

  await page.locator('#btn-dice-plus').click();
  await expect(result(page)).not.toHaveClass(/rolled/);
  await page.locator('#btn-dice-minus').click();
  await expect(result(page)).toHaveClass(/rolled/);
});
