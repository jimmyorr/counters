import { test, expect } from './fixtures.js';
import {
  seed, stored, counter, card, valueOf, labels, openMainMenuItem, confirm, undo,
} from './helpers.js';

const actions = async (page) =>
  ((await stored(page, 'counters-history')) ?? []).map((h) => h.actionLabel);

test('undo restores a deleted counter at its original position', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha'), counter('b', 'Bravo'), counter('c', 'Charlie')] });
  await page.goto('/');

  await card(page, 'b').locator('.btn-counter-edit').click();
  await page.locator('#edit-btn-delete').click();
  await confirm(page);
  await expect(labels(page)).toHaveText(['Alpha', 'Charlie']);

  await undo(page);
  await expect(labels(page)).toHaveText(['Alpha', 'Bravo', 'Charlie']);
  expect(await actions(page)).not.toContain('Deleted counter');
  expect(await stored(page, 'counters-list')).toHaveLength(3);
});

test('undo reverts reset all', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 5), counter('b', 'Bravo', 7)] });
  await page.goto('/');

  await openMainMenuItem(page, 'menu-btn-reset-counters');
  await confirm(page);
  await expect(valueOf(card(page, 'a'))).toHaveText('0');
  await expect(valueOf(card(page, 'b'))).toHaveText('0');

  await undo(page);
  await expect(valueOf(card(page, 'a'))).toHaveText('5');
  await expect(valueOf(card(page, 'b'))).toHaveText('7');
  expect(await actions(page)).not.toContain('Reset counter');
  expect((await stored(page, 'counters-list')).map((c) => c.value)).toEqual([5, 7]);
});

test('undo reverts delete all, including history', async ({ page }) => {
  const history = [
    { id: 'h1', counterLabel: 'Alpha', color: 0, actionLabel: '+1', progression: '0 → 1', timestamp: '10:00:00' },
  ];
  await seed(page, { counters: [counter('a', 'Alpha', 1), counter('b', 'Bravo')], history });
  await page.goto('/');

  await openMainMenuItem(page, 'menu-btn-delete-all');
  await confirm(page);
  await expect(page.locator('#empty-state-view')).toBeVisible();
  expect(await stored(page, 'counters-list')).toEqual([]);

  await undo(page);
  await expect(labels(page)).toHaveText(['Alpha', 'Bravo']);
  expect(await stored(page, 'counters-list')).toHaveLength(2);
  expect(await stored(page, 'counters-history')).toEqual(history);
});
