import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, valueOf, confirm } from './helpers.js';

const openEdit = async (page, id) => {
  await card(page, id).locator('.btn-counter-edit').click();
  await expect(page.locator('#edit-counter-dialog')).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 10)] });
  await page.goto('/');
});

test('saves label, value, increment, and reset value', async ({ page }) => {
  await openEdit(page, 'a');
  await expect(page.locator('#edit-dialog-title')).toHaveText('Edit Alpha');
  await page.locator('#edit-label').fill('Ace');
  await page.locator('#edit-value-input-details').fill('2.5'); // decimals allowed (#15)
  await page.locator('#edit-increment').fill('3');
  await page.locator('#edit-reset-val').fill('7');
  await page.locator('#edit-counter-form button[type="submit"]').click();
  await expect(page.locator('#edit-counter-dialog')).toBeHidden();

  const alpha = card(page, 'a');
  await expect(alpha.locator('.counter-label')).toHaveText('Ace');
  await expect(valueOf(alpha)).toHaveText('2.5');
  expect((await stored(page, 'counters-list'))[0]).toMatchObject({
    label: 'Ace', value: 2.5, increment: 3, resetValue: 7,
  });

  // The new increment applies to the + zone
  await alpha.locator('.card-direct-zone-plus').click();
  await expect(valueOf(alpha)).toHaveText('5.5');

  // Card reset honors the configured reset value (#13)
  await alpha.locator('.btn-counter-reset').click();
  await confirm(page);
  await expect(valueOf(alpha)).toHaveText('7');
});

test('changing the color updates the card', async ({ page }) => {
  await openEdit(page, 'a');
  await page.locator('#edit-palette-container .palette-swatch[data-color-id="4"]').click();
  await page.locator('#edit-counter-form button[type="submit"]').click();
  await expect(card(page, 'a')).toHaveClass(/card-color-4/);
  expect((await stored(page, 'counters-list'))[0].color).toBe(4);
});

test('logs value edits separately from detail edits', async ({ page }) => {
  await openEdit(page, 'a');
  await page.locator('#edit-label').fill('Ace');
  await page.locator('#edit-counter-form button[type="submit"]').click();
  await openEdit(page, 'a');
  await page.locator('#edit-value-input-details').fill('11');
  await page.locator('#edit-counter-form button[type="submit"]').click();

  await expect
    .poll(async () => (await stored(page, 'counters-history')).map((h) => h.actionLabel))
    .toEqual(['Edited value', 'Edited details']);
});
