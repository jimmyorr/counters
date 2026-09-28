import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, labels, openMainMenuItem, confirm } from './helpers.js';

const T0 = new Date('2026-01-01T00:00:00');

// Freeze time so the 3s debounce is exact regardless of how long actions take
const bootFrozen = async (page) => {
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
};

const three = () => [counter('a', 'Alpha'), counter('b', 'Bravo'), counter('c', 'Charlie')];

test('waits 3 seconds after the last tap before sorting', async ({ page }) => {
  await seed(page, { counters: three(), settings: { autoSort: true } });
  await bootFrozen(page);

  await card(page, 'c').locator('.card-direct-zone-plus').click();
  await page.clock.runFor(2900);
  await expect(labels(page)).toHaveText(['Alpha', 'Bravo', 'Charlie']);

  await page.clock.runFor(200);
  await expect(labels(page)).toHaveText(['Charlie', 'Alpha', 'Bravo']);
});

test('sorts ascending when the top bar shows the lowest', async ({ page }) => {
  await seed(page, {
    counters: three(),
    settings: { autoSort: true, topBarContent: 'lowest' },
  });
  await bootFrozen(page);

  await card(page, 'a').locator('.card-direct-zone-plus').click();
  await page.clock.runFor(3100);
  await expect(labels(page)).toHaveText(['Bravo', 'Charlie', 'Alpha']);
});

test('turning auto-sort on sorts immediately', async ({ page }) => {
  await seed(page, {
    counters: [counter('a', 'Alpha', 1), counter('b', 'Bravo', 9), counter('c', 'Charlie', 5)],
  });
  await page.goto('/');

  await page.locator('#header-leader-container').click();
  // The checkbox is visually hidden behind a styled switch; tap the switch
  await page.locator('label:has(#options-auto-sort)').click();
  await expect(labels(page)).toHaveText(['Bravo', 'Charlie', 'Alpha']);
  expect((await stored(page, 'counters-settings')).autoSort).toBe(true);
});

test('shuffle turns auto-sort off so it does not undo the shuffle', async ({ page }) => {
  await seed(page, { counters: three(), settings: { autoSort: true } });
  await page.goto('/');

  await openMainMenuItem(page, 'menu-btn-shuffle-counters');
  await expect.poll(async () => (await stored(page, 'counters-settings')).autoSort).toBe(false);
});

test('deleting while a sort is pending removes the right counter', async ({ page }) => {
  await seed(page, {
    counters: [counter('a', 'Alpha'), counter('b', 'Bravo')],
    settings: { autoSort: true },
  });
  await bootFrozen(page);

  const bravo = card(page, 'b');
  await bravo.locator('.card-direct-zone-plus').click(); // schedules the sort at +3s
  await page.clock.runFor(2500);
  await bravo.locator('.card-header').click();
  await page.locator('#edit-btn-delete').click();
  await confirm(page); // deletion completes 700ms later, after the sort fires
  await page.clock.runFor(1500);

  await expect(labels(page)).toHaveText(['Alpha']);
});
