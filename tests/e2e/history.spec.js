import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, confirm } from './helpers.js';

const items = (page) => page.locator('#history-items-wrapper .history-item');

const openHistory = async (page) => {
  await page.locator('#btn-open-history').click();
  await expect(page.locator('#history-dialog')).toBeVisible();
};

test('logs increments with before and after values', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 4)] });
  await page.goto('/');
  await card(page, 'a').locator('.card-direct-zone-plus').click();
  await card(page, 'a').locator('.card-direct-zone-minus').click();

  await openHistory(page);
  await expect(items(page)).toHaveCount(2);
  const latest = items(page).first();
  await expect(latest.locator('.history-counter')).toHaveText('Alpha');
  await expect(latest.locator('.history-event')).toHaveText('−1');
  await expect(latest.locator('.history-progression')).toHaveText('5 → 4');
});

test('renders HTML in labels as plain text', async ({ page }) => {
  const evil = '<img src=x onerror="window.__xss=1">';
  await seed(page, { counters: [counter('a', evil)] });
  await page.goto('/');

  await expect(card(page, 'a').locator('.counter-label')).toHaveText(evil);
  await card(page, 'a').locator('.card-direct-zone-plus').click();
  await openHistory(page);
  await expect(items(page).first().locator('.history-counter')).toHaveText(evil);

  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('#counters-list-wrapper img, #history-items-wrapper img')).toHaveCount(0);
});

test('keeps only the 50 most recent entries', async ({ page }) => {
  const history = Array.from({ length: 50 }, (_, i) => ({
    id: `h${i}`, counterLabel: 'Old', color: 0, actionLabel: '+1', progression: '', timestamp: '09:00:00',
  }));
  await seed(page, { counters: [counter('a', 'Alpha')], history });
  await page.goto('/');
  await card(page, 'a').locator('.card-direct-zone-plus').click();

  await expect.poll(async () => (await stored(page, 'counters-history'))[0].counterLabel).toBe('Alpha');
  const saved = await stored(page, 'counters-history');
  expect(saved).toHaveLength(50);
  expect(saved.at(-1).id).toBe('h48');
});

test('clear history empties the log', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha')] });
  await page.goto('/');
  await card(page, 'a').locator('.card-direct-zone-plus').click();

  await openHistory(page);
  await page.locator('#history-btn-clear').click();
  await confirm(page);
  await expect(items(page)).toHaveCount(0);
  await expect(page.locator('#history-empty-view')).toBeVisible();
  expect(await stored(page, 'counters-history')).toEqual([]);
});
