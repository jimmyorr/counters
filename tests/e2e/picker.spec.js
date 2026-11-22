import { test, expect } from './fixtures.js';
import { seed } from './helpers.js';

const T0 = new Date('2026-01-01T00:00:00');

const circles = (page) => page.locator('#picker-circles .picker-circle');
const winnerCircle = (page) => page.locator('#picker-circles .picker-circle.is-winner');
const promptEl = (page) => page.locator('#picker-prompt');
const promptTitle = (page) => page.locator('#picker-prompt-title');

const dispatchPointer = async (page, type, pointerId, offsetX = 100, offsetY = 100) => {
  await page.evaluate(
    ({ type, pointerId, offsetX, offsetY }) => {
      const stage = document.getElementById('picker-stage');
      const rect = stage.getBoundingClientRect();
      stage.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 1,
          clientX: rect.left + offsetX,
          clientY: rect.top + offsetY,
        }),
      );
    },
    { type, pointerId, offsetX, offsetY },
  );
};

test.describe('Picker tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: T0 });
    await page.goto('/');
    await page.locator('[data-tab-btn="picker"]').click();
    await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
    await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
  });

  test('opens the Picker tab with header title and idle prompt', async ({ page }) => {
    await expect(page.locator('#app-view-title')).toHaveText('Picker');
    await expect(page.locator('[data-tab-btn="picker"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-picker')).toHaveJSProperty('inert', false);
    await expect(promptEl(page)).not.toHaveClass(/hidden/);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');
    await expect(circles(page)).toHaveCount(0);
  });

  test('single finger shows one circle and does not select after 3+ seconds', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 120, 140);
    await expect(circles(page)).toHaveCount(1);
    await expect(promptTitle(page)).toHaveText('Waiting for another player');

    await page.clock.runFor(4500);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(0);

    await dispatchPointer(page, 'pointerup', 1, 120, 140);
    await expect(circles(page)).toHaveCount(0);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');
  });

  test('two or more fingers get unique colors and pick one winner after 3 seconds', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await dispatchPointer(page, 'pointerdown', 3, 140, 240);

    await expect(circles(page)).toHaveCount(3);
    await expect(promptEl(page)).toHaveClass(/hidden/);

    const colors = await circles(page).evaluateAll((els) => els.map((el) => el.dataset.color));
    expect(new Set(colors).size).toBe(3);

    // Just before 3s: all 3 circles still present
    await page.clock.runFor(2900);
    await expect(circles(page)).toHaveCount(3);
    await expect(winnerCircle(page)).toHaveCount(0);

    // At 3s: all but one vanish and the winner is highlighted
    await page.clock.runFor(200);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(1);
    await expect(page.locator('#picker-status')).toHaveText('Player selected');
  });

  test('adding a finger mid-countdown resets the 3-second timer', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);

    await page.clock.runFor(2000);
    await expect(circles(page)).toHaveCount(2);

    // 3rd finger resets the 3s countdown
    await dispatchPointer(page, 'pointerdown', 3, 140, 240);
    await expect(circles(page)).toHaveCount(3);

    // 2s after the 3rd finger (4s total) — still counting
    await page.clock.runFor(2000);
    await expect(circles(page)).toHaveCount(3);
    await expect(winnerCircle(page)).toHaveCount(0);

    // 1.1s later (3.1s after 3rd finger) — winner selected
    await page.clock.runFor(1100);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(1);
  });

  test('lifting a finger resets countdown, and dropping below 2 cancels it', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await dispatchPointer(page, 'pointerdown', 3, 140, 240);

    await page.clock.runFor(2000);
    // Lift 3rd finger: 2 remain, timer resets to full 3s
    await dispatchPointer(page, 'pointerup', 3, 140, 240);
    await expect(circles(page)).toHaveCount(2);

    await page.clock.runFor(2000);
    await expect(circles(page)).toHaveCount(2);
    await expect(winnerCircle(page)).toHaveCount(0);

    // Lift 2nd finger: only 1 remains, countdown is cancelled
    await dispatchPointer(page, 'pointerup', 2, 200, 120);
    await expect(circles(page)).toHaveCount(1);
    await expect(promptTitle(page)).toHaveText('Waiting for another player');

    await page.clock.runFor(4000);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(0);
  });

  test('moving a finger updates its circle position', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 100);
    const circle = circles(page).first();
    await expect(circle).toHaveCSS('--x', '80px');
    await expect(circle).toHaveCSS('--y', '100px');

    await dispatchPointer(page, 'pointermove', 1, 165, 225);
    await expect(circle).toHaveCSS('--x', '165px');
    await expect(circle).toHaveCSS('--y', '225px');
  });

  test('winner stays highlighted until all fingers lift, then resets for a new round', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await page.clock.runFor(3100);

    await expect(winnerCircle(page)).toHaveCount(1);
    const winningId = Number(await winnerCircle(page).getAttribute('data-pointer-id'));
    const otherId = winningId === 1 ? 2 : 1;

    // Even if the winner lifts first, the highlight stays until all fingers lift
    await dispatchPointer(page, 'pointerup', winningId, 80, 120);
    await expect(winnerCircle(page)).toHaveCount(1);

    // Lifting the remaining finger resets cleanly to idle
    await dispatchPointer(page, 'pointerup', otherId, 200, 120);
    await expect(circles(page)).toHaveCount(0);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');

    // Ready for a brand new round immediately
    await dispatchPointer(page, 'pointerdown', 10, 90, 150);
    await dispatchPointer(page, 'pointerdown', 11, 210, 150);
    await expect(circles(page)).toHaveCount(2);
    await page.clock.runFor(3100);
    await expect(winnerCircle(page)).toHaveCount(1);
  });

  test('switching away from the Picker tab resets active touches and countdown', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await expect(circles(page)).toHaveCount(2);

    await page.locator('[data-tab-btn="counters"]').click();
    await page.clock.runFor(3500);

    await page.locator('[data-tab-btn="picker"]').click();
    await expect(circles(page)).toHaveCount(0);
    await expect(winnerCircle(page)).toHaveCount(0);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');
  });
});

test('Picker uses colors from the active app palette', async ({ page }) => {
  await seed(page, { settings: { palette: 'pastel' } });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });

  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);

  const pastelColors = new Set([
    '#93ddfa',
    '#fdc399',
    '#fdb2c8',
    '#c1d0fb',
    '#b6dfa0',
    '#e9cf87',
    '#86e6d3',
    '#d4b3fc',
  ]);
  const assigned = await circles(page).evaluateAll((els) => els.map((el) => el.dataset.color));
  expect(assigned).toHaveLength(2);
  for (const color of assigned) {
    expect(pastelColors.has(color)).toBe(true);
  }
});
