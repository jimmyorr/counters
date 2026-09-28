import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, valueOf, labels } from './helpers.js';

// #29: the card header is just the title; tapping it opens the edit dialog

const dialog = (page) => page.locator('#edit-counter-dialog');
const nameField = (page) => page.locator('#edit-label');

test('the header shows only the name and is a button that opens the editor', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Starling')] });
  await page.goto('/');
  const header = card(page, 'a').locator('.card-header');
  await expect(header.locator('button')).toHaveCount(0);
  await expect(card(page, 'a').getByRole('button', { name: 'Edit Starling' })).toBeVisible();

  await header.click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#edit-dialog-title')).toHaveText('Edit Starling');
});

test('the header opens the editor from the keyboard', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha')] });
  await page.goto('/');
  await card(page, 'a').locator('.card-header').focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
});

test('a new counter opens with its automatic name selected for renaming', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-add-counter').click();
  const header = page.locator('.counter-card .card-header').first();
  await header.click();
  await expect(nameField(page)).toBeFocused();
  // Typing replaces the whole automatic name
  await expect.poll(() => nameField(page).evaluate((el) => el.selectionEnd - el.selectionStart)).toBe(
    await nameField(page).evaluate((el) => el.value.length),
  );
  await page.keyboard.type('Grandma');
  await page.locator('#edit-btn-save').click();
  await expect(labels(page)).toHaveText(['Grandma']);
  expect((await stored(page, 'counters-list'))[0]).not.toHaveProperty('autoNamed');

  // Once renamed, the editor opens without focusing a field (no keyboard pop-up)
  await header.click();
  await expect(dialog(page)).toBeVisible();
  await expect(nameField(page)).not.toBeFocused();
});

test('saving without renaming keeps the automatic-name behavior', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-add-counter').click();
  await page.locator('.counter-card .card-header').first().click();
  await page.locator('#edit-increment').fill('2');
  await page.locator('#edit-btn-save').click();
  expect((await stored(page, 'counters-list'))[0].autoNamed).toBe(true);
});

test('reset in the editor applies immediately and can be undone', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 12, { resetValue: 3 })] });
  await page.goto('/');
  await card(page, 'a').locator('.card-header').click();
  await expect(page.locator('#edit-btn-reset')).toHaveText('Reset to 3');

  // The label follows the reset field as it's edited
  await page.locator('#edit-reset-val').fill('5');
  await expect(page.locator('#edit-btn-reset')).toHaveText('Reset to 5');
  await page.locator('#edit-btn-reset').click();
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('5');
  expect((await stored(page, 'counters-list'))[0]).toMatchObject({ value: 5, resetValue: 5 });

  await page.locator('#toast-action').click();
  await expect(valueOf(card(page, 'a'))).toHaveText('12');
  const history = await stored(page, 'counters-history');
  expect(history.map((h) => h.actionLabel)).not.toContain('Reset value');
});

test('pressing and holding the header without moving still opens the editor', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha'), counter('b', 'Bravo')] });
  await page.goto('/');
  const box = await card(page, 'a').locator('.card-header').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600); // past the drag threshold, but no movement
  await page.mouse.up();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#edit-dialog-title')).toHaveText('Edit Alpha');
});

// Enter in any field must save, never trigger "Reset to N"
test('pressing Enter after renaming saves without resetting', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Robin', 9, { autoNamed: true })] });
  await page.goto('/');
  await card(page, 'a').locator('.card-header').click();
  await expect(nameField(page)).toBeFocused();
  await page.keyboard.type('Foo');
  await page.keyboard.press('Enter');

  await expect(dialog(page)).toBeHidden();
  await expect(labels(page)).toHaveText(['Foo']);
  await expect(valueOf(card(page, 'a'))).toHaveText('9');
  await expect(page.locator('#toast-text')).toHaveText('Counter saved');

  // Same from a number field
  await card(page, 'a').locator('.card-header').click();
  await page.locator('#edit-increment').fill('2');
  await page.locator('#edit-increment').press('Enter');
  await expect(dialog(page)).toBeHidden();
  await expect(valueOf(card(page, 'a'))).toHaveText('9');
});
