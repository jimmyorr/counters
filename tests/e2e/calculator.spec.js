import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, valueOf, openCalculator } from './helpers.js';

const dialog = (page) => page.locator('#calculator-dialog');

test.beforeEach(async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 10)] });
  await page.goto('/');
});

test('shows the counter label and value in the title', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await expect(page.locator('#calc-dialog-title')).toHaveText('Alpha: 10');
});

test('quick-add button applies instantly and closes', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-quick-add-container button[data-quick-val="5"]').click();
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('15');
  expect((await stored(page, 'counters-list'))[0].value).toBe(15);
});

test('displays the number pad and keeps quick-add controls available', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await expect(page.locator('#calc-quick-add-container')).toBeVisible();
  await expect(page.locator('#calc-numpad-container')).toBeVisible();
  await expect(page.locator('#calc-numpad-display')).toHaveText('0');
  await expect(page.locator('#calc-numpad-btn-add')).toHaveText('Add');
  await expect(page.locator('#calc-numpad-btn-subtract')).toHaveText('Subtract');
});

test('tapping a number updates Add and Subtract buttons, and Add increments value', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-numpad-grid button[data-key="7"]').click();

  await expect(page.locator('#calc-numpad-display')).toHaveText('7');
  await expect(page.locator('#calc-numpad-btn-add')).toHaveText('Add 7');
  await expect(page.locator('#calc-numpad-btn-subtract')).toHaveText('Subtract 7');

  await page.locator('#calc-numpad-btn-add').click();
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('17');
  expect((await stored(page, 'counters-list'))[0].value).toBe(17);
});

test('tapping Subtract decrements value directly', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-numpad-grid button[data-key="7"]').click();
  await page.locator('#calc-numpad-btn-subtract').click();

  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('3');
  expect((await stored(page, 'counters-list'))[0].value).toBe(3);
});

test('handles decimals, backspace, and clear', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  const key = (k) => page.locator(`#calc-numpad-grid button[data-key="${k}"]`);

  await key('2').click();
  await key('.').click();
  await key('5').click();
  await expect(page.locator('#calc-numpad-display')).toHaveText('2.5');
  await expect(page.locator('#calc-numpad-btn-add')).toHaveText('Add 2.5');

  // Backspace removes trailing char
  await page.locator('#calc-numpad-backspace').click();
  await expect(page.locator('#calc-numpad-display')).toHaveText('2.');

  // Clear resets to 0
  await key('clear').click();
  await expect(page.locator('#calc-numpad-display')).toHaveText('0');
  await expect(page.locator('#calc-numpad-btn-add')).toHaveText('Add');
});

test('submitting empty value closes without changing counter', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-numpad-btn-add').click();
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('10');
});

test('opens from the keyboard', async ({ page }) => {
  await card(page, 'a').locator('.card-value-body').focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#calc-numpad-display')).toBeVisible();
});

test('supports desktop keyboard input', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.keyboard.press('8');
  await expect(page.locator('#calc-numpad-display')).toHaveText('8');
  await expect(page.locator('#calc-numpad-btn-add')).toHaveText('Add 8');

  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('18');
});

test('accepts decimal quick-add presets and avoids floating-point drift', async ({ page }) => {
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  const quickInput = page.locator('#setting-quick-add-values');
  await quickInput.fill('0.1, 0.2, 2.5');
  await expect(page.locator('#quick-add-feedback')).toBeHidden();
  await expect(quickInput).not.toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');

  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-quick-add-container button[data-quick-val="0.1"]').click();
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-quick-add-container button[data-quick-val="0.2"]').click();

  await expect(valueOf(card(page, 'a'))).toHaveText('10.3');
  expect((await stored(page, 'counters-list'))[0].value).toBe(10.3);
});

test('score hitbox shares width rather than tightly wrapping the number', async ({ page }) => {
  const cardLocator = card(page, 'a');
  const cardBox = await cardLocator.boundingBox();
  const valueBox = await cardLocator.locator('.card-value-body').boundingBox();
  const displayBox = await cardLocator.locator('.value-display').boundingBox();

  expect(valueBox.width).toBeGreaterThan(displayBox.width + 30);
  expect(valueBox.width / cardBox.width).toBeGreaterThan(0.25);
});
