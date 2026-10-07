import { test, expect } from './fixtures.js';
import { seed, counter, card, cards, valueOf, confirm } from './helpers.js';

// Delete, delete all, and reset animations. Playwright's clock also drives
// animation frames, so pausing it holds each animation at its first frame
// and runFor() steps it on exactly.

const T0 = new Date('2026-01-01T00:00:00');
const three = () => [counter('a', 'Alpha', 12), counter('b', 'Bravo', 30), counter('c', 'Charlie', 5)];
const ghosts = (page) => page.locator('body > .counter-card[aria-hidden="true"]');

const start = async (page) => {
  await seed(page, { counters: three() });
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
};

const deleteCounter = async (page, id) => {
  await card(page, id).locator('.card-header').click();
  await page.locator('#edit-btn-delete').click();
  await confirm(page);
};

const menu = async (page, item) => {
  await page.locator('#btn-open-options').click();
  await page.locator(item).click();
  await confirm(page);
};

test.describe('deleting a counter', () => {
  test('removes it and offers Undo at once', async ({ page }) => {
    await start(page);
    await deleteCounter(page, 'a');
    // No clock time has passed, so nothing waited on the animation
    await expect(cards(page)).toHaveCount(2);
    await expect(page.locator('#toast-wrapper')).toContainText('Counter deleted');
  });

  test('tumbles a copy out in front while the rest slide into place', async ({ page }) => {
    await start(page);
    await deleteCounter(page, 'a');
    await expect(ghosts(page)).toHaveCount(1);
    await expect(ghosts(page)).toHaveCSS('z-index', '150');
    // Bravo starts where it was (one card lower) and springs up from there
    expect(await card(page, 'b').evaluate((el) => el.style.transform)).toMatch(/^translate\(0px, \d+(\.\d+)?px\)$/);
    await page.clock.runFor(1000);
    await expect(card(page, 'b')).toHaveCSS('transform', 'none');
    await expect(ghosts(page)).toHaveCount(0);
  });
});

test('deleting all shows the empty state at once and brings it in as the cards leave', async ({ page }) => {
  await start(page);
  await menu(page, '#menu-btn-delete-all');
  await expect(page.locator('#empty-state-view')).toBeVisible();
  await expect(page.locator('#header-leader-container')).toHaveCSS('opacity', '0');
  await expect(ghosts(page)).toHaveCount(3);
  const entering = await page
    .locator('#btn-empty-placeholder-icon')
    .evaluate((el) => el.getAnimations().length);
  expect(entering).toBe(1);
});

test.describe('resetting', () => {
  test('counts each value down to its reset value', async ({ page }) => {
    await start(page);
    await menu(page, '#menu-btn-reset-counters');
    // Old values hold while the confirm sheet slides away...
    await expect(valueOf(card(page, 'b'))).toHaveText('30');
    // ...then count down...
    await page.clock.runFor(550);
    const midway = Number(await valueOf(card(page, 'b')).textContent());
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(30);
    // ...and land
    await page.clock.runFor(1000);
    for (const id of ['a', 'b', 'c']) await expect(valueOf(card(page, id))).toHaveText('0');
  });

  test('a single counter counts down too', async ({ page }) => {
    await start(page);
    await card(page, 'b').locator('.card-header').click();
    await page.locator('#edit-btn-reset').click();
    await expect(valueOf(card(page, 'b'))).toHaveText('30');
    await page.clock.runFor(1500);
    await expect(valueOf(card(page, 'b'))).toHaveText('0');
  });

  test('a tap during the count wins', async ({ page }) => {
    await start(page);
    await menu(page, '#menu-btn-reset-counters');
    await page.clock.runFor(450);
    await card(page, 'b').getByRole('button', { name: 'Add 1 to Bravo' }).click();
    await page.clock.runFor(1500);
    await expect(valueOf(card(page, 'b'))).toHaveText('1');
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('everything changes at once', async ({ page }) => {
    await start(page);
    await menu(page, '#menu-btn-reset-counters');
    await expect(valueOf(card(page, 'b'))).toHaveText('0');
    await deleteCounter(page, 'a');
    await expect(cards(page)).toHaveCount(2);
    await expect(ghosts(page)).toHaveCount(0);
  });
});
