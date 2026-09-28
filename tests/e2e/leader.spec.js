import { test, expect } from './fixtures.js';
import { seed, counter, card, confirm } from './helpers.js';

const pill = (page) => page.locator('#header-leader-container');
const pillText = (page) => page.locator('#header-leader-text');

const three = () => [
  counter('a', 'Alpha', 5, { color: 1 }),
  counter('b', 'Bravo', 9, { color: 4 }),
  counter('c', 'Charlie', 2, { color: '#123456' }),
];

test('shows the highest counter in its color', async ({ page }) => {
  await seed(page, { counters: three() });
  await page.goto('/');
  await expect(pillText(page)).toHaveText('Bravo');
  // Bold grass green swatch
  await expect(pill(page)).toHaveCSS('--leader-color', '#5a8012');
});

test('shows the lowest counter, including custom colors', async ({ page }) => {
  await seed(page, { counters: three(), settings: { topBarContent: 'lowest' } });
  await page.goto('/');
  await expect(pillText(page)).toHaveText('Charlie');
  await expect(pill(page)).toHaveCSS('--leader-color', '#123456');
});

test('shows the total', async ({ page }) => {
  await seed(page, { counters: three(), settings: { topBarContent: 'total' } });
  await page.goto('/');
  await expect(pillText(page)).toHaveText('Total: 16');
});

test('ties go to the counter shown first', async ({ page }) => {
  await seed(page, {
    counters: [counter('a', 'Alpha', 3), counter('b', 'Bravo', 3)],
    settings: { topBarContent: 'lowest' },
  });
  await page.goto('/');
  await expect(pillText(page)).toHaveText('Alpha');
});

test('updates when values change and switching modes', async ({ page }) => {
  await seed(page, { counters: three() });
  await page.goto('/');
  for (let i = 0; i < 5; i++) await card(page, 'a').locator('.card-direct-zone-plus').click();
  await expect(pillText(page)).toHaveText('Alpha');

  await pill(page).click();
  await page.locator('#topbar-opt-lowest').click();
  await expect(pillText(page)).toHaveText('Charlie');
});

test('clears when the last counter is deleted', async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha', 4)] });
  await page.goto('/');
  await card(page, 'a').locator('.btn-counter-edit').click();
  await page.locator('#edit-btn-delete').click();
  await confirm(page);
  await expect(page.locator('#empty-state-view')).toBeVisible();
  await expect(pillText(page)).toHaveText('');
});
