import { test, expect } from './fixtures.js';

const cards = (page) => page.locator('#counters-list-wrapper .counter-card');
const valueOf = (card) => card.locator('.value-display');

test('shows the empty state on first launch', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Counters');
  await expect(page.locator('#empty-state-view')).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test('adds a counter and changes its value', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-add-counter').click();

  const card = cards(page).first();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('#empty-state-view')).toBeHidden();
  await expect(valueOf(card)).toHaveText('0');

  await card.locator('.card-direct-zone-plus').click();
  await card.locator('.card-direct-zone-plus').click();
  await expect(valueOf(card)).toHaveText('2');

  await card.locator('.card-direct-zone-minus').click();
  await expect(valueOf(card)).toHaveText('1');
});

test('keeps counters after a reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-add-counter').click();
  const card = cards(page).first();
  await card.locator('.card-direct-zone-plus').click();
  await expect(valueOf(card)).toHaveText('1');

  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(valueOf(cards(page).first())).toHaveText('1');
});
