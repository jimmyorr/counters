import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, valueOf, openCalculator } from './helpers.js';

const dialog = (page) => page.locator('#calculator-dialog');
const input = (page) => page.locator('#calc-number-input');

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

test('minus toggle flips quick-add labels and subtracts', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-op-minus').click();
  await expect(page.locator('#calc-quick-add-container button').first()).toHaveText('−5');

  await input(page).fill('3');
  await expect(page.locator('#calc-btn-submit')).toHaveText('Subtract 3');
  await page.locator('#calc-btn-submit').click();
  await expect(valueOf(card(page, 'a'))).toHaveText('7');
});

test('Enter submits the typed value, including decimals', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await input(page).fill('2.5');
  await input(page).press('Enter');
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('12.5');
});

test('submitting an empty value closes without changing anything', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-btn-submit').click();
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('10');
});

test('opens from the keyboard', async ({ page }) => {
  await card(page, 'a').locator('.card-value-body').focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
});

test('always opens in add mode', async ({ page }) => {
  await openCalculator(page, card(page, 'a'));
  await page.locator('#calc-op-minus').click();
  await page.locator('#calculator-dialog [command="close"]').click();

  await openCalculator(page, card(page, 'a'));
  await expect(page.locator('#calc-op-plus')).toHaveClass(/active/);
  await expect(page.locator('#calc-quick-add-container button').first()).toHaveText('+5');
});
