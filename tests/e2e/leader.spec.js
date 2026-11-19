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
  await card(page, 'a').locator('.card-header').click();
  await page.locator('#edit-btn-delete').click();
  await confirm(page);
  await expect(page.locator('#empty-state-view')).toBeVisible();
  await expect(pillText(page)).toHaveText('');
  await expect(page.locator('#ambient-backdrop')).toHaveAttribute('data-leader-color', '');
});

test.describe('ambient leader gradient', () => {
  test('subtly tints the backdrop with the leader color and interpolates slowly on leader change', async ({ page }) => {
    await seed(page, { counters: three(), settings: { theme: 'dark' } });
    await page.goto('/');
    const backdrop = page.locator('#ambient-backdrop');

    // Starts immediately settled on Bravo (#5a8012) without a boot transition
    await expect(backdrop).toHaveAttribute('data-leader-color', '#5a8012');
    expect(await backdrop.evaluate((el) => el.getAnimations().length)).toBe(0);
    const initialBg = await backdrop.evaluate((el) => getComputedStyle(el).backgroundImage);

    // Alpha (#c73511) overtakes Bravo: triggers a slow 2.6s @property color transition
    for (let i = 0; i < 5; i++) await card(page, 'a').locator('.card-direct-zone-plus').click();
    await expect(pillText(page)).toHaveText('Alpha');
    await expect(backdrop).toHaveAttribute('data-leader-color', '#c73511');

    const { props, durations, midBg, endBg } = await backdrop.evaluate((el) => {
      const anims = el.getAnimations();
      const props = anims.map((a) => a.transitionProperty).sort();
      const durations = anims.map((a) => a.effect.getComputedTiming().duration);
      anims.forEach((a) => {
        a.pause();
        a.currentTime = 1300;
      });
      const midBg = getComputedStyle(el).backgroundImage;
      anims.forEach((a) => a.finish());
      const endBg = getComputedStyle(el).backgroundImage;
      return { props, durations, midBg, endBg };
    });

    expect(props).toEqual(['--ambient-glow-1', '--ambient-glow-2', '--ambient-glow-3']);
    expect(durations).toEqual([2600, 2600, 2600]);
    expect(midBg).not.toBe(initialBg);
    expect(midBg).not.toBe(endBg);

    // Switching to Total mode clears the leader influence
    await pill(page).click();
    await page.locator('#topbar-opt-total').click();
    await expect(backdrop).toHaveAttribute('data-leader-color', '');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('switches immediately without animating', async ({ page }) => {
      await seed(page, { counters: three() });
      await page.goto('/');
      for (let i = 0; i < 5; i++) await card(page, 'a').locator('.card-direct-zone-plus').click();
      await expect(page.locator('#ambient-backdrop')).toHaveAttribute('data-leader-color', '#c73511');
      expect(await page.locator('#ambient-backdrop').evaluate((el) => el.getAnimations().length)).toBe(0);
    });
  });
});
