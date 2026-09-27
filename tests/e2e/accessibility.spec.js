import { test, expect } from './fixtures.js';
import { seed, counter, card } from './helpers.js';

test.describe('counter cards', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      counters: [counter('a', 'Alpha', 3, { increment: 5 }), counter('b', 'Bravo', 8)],
    });
    await page.goto('/');
  });

  test('controls name their counter, value, and step', async ({ page }) => {
    const alpha = card(page, 'a');
    await expect(alpha.getByRole('button', { name: 'Alpha: 3. Open calculator' })).toBeVisible();
    await expect(alpha.getByRole('button', { name: 'Add 5 to Alpha' })).toBeVisible();
    await expect(alpha.getByRole('button', { name: 'Subtract 5 from Alpha' })).toBeVisible();
    await expect(card(page, 'b').getByRole('button', { name: 'Add 1 to Bravo' })).toBeVisible();
  });

  test('announces the new value after a change', async ({ page }) => {
    await card(page, 'a').getByRole('button', { name: 'Add 5 to Alpha' }).click();
    await expect(page.locator('#sr-announcer')).toHaveText('Alpha: 8');
    await expect(page.locator('#sr-announcer')).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('toast', () => {
  test('is announced as a status message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#toast-wrapper')).toHaveAttribute('role', 'status');
  });

  test('keeps Undo available while it has focus', async ({ page }) => {
    const T0 = new Date('2026-01-01T00:00:00');
    await seed(page, { counters: [counter('a', 'Alpha')] });
    await page.clock.install({ time: T0 });
    await page.goto('/');
    await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

    await card(page, 'a').locator('.btn-counter-edit').click();
    await page.locator('#edit-btn-delete').click();
    await page.locator('#confirm-btn-ok').click();
    await page.clock.runFor(1000); // delete animation
    const undo = page.locator('#toast-action');
    await expect(undo).toBeVisible();

    await undo.focus();
    await page.clock.runFor(10_000); // well past the 5s timeout
    await expect(undo).toBeVisible();

    await undo.blur();
    await page.clock.runFor(5100);
    await expect(undo).toBeHidden();
  });
});
