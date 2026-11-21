import { test, expect } from './fixtures.js';

const expectActiveTab = async (page, tabId, title) => {
  await expect(page.locator(`[data-tab-btn="${tabId}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#app-view-title')).toHaveText(title);
  await expect(page.locator(`#tab-${tabId}`)).toHaveJSProperty('inert', false);
  await expect(page.locator(`#tab-${tabId}`)).toBeInViewport({ ratio: 0.95 });
};

// Perform a real Chromium touch swipe across #tabs-slider so both native
// scroll-snap tabs and Picker's single-finger swipe handler are exercised.
const touchSwipe = async (page, cdp, direction) => {
  const box = await page.locator('#tabs-slider').boundingBox();
  const y = Math.round(box.y + box.height * 0.5);
  const startX = Math.round(box.x + box.width * (direction === 'left' ? 0.85 : 0.25));
  const endX = Math.round(box.x + box.width * (direction === 'left' ? 0.15 : 0.9));
  const steps = 10;

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y, id: 1 }],
  });

  for (let i = 1; i <= steps; i++) {
    const x = Math.round(startX + ((endX - startX) * i) / steps);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
    });
    await page.waitForTimeout(16);
  }

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
};

test('swiping left and right navigates across all tabs in order', async ({ page }) => {
  await page.goto('/');
  const cdp = await page.context().newCDPSession(page);

  await expectActiveTab(page, 'counters', 'Counters');

  // Swipe forward through every tab: Counters -> Dice -> Timer -> Picker
  await touchSwipe(page, cdp, 'left');
  await expectActiveTab(page, 'dice', 'Dice');

  await touchSwipe(page, cdp, 'left');
  await expectActiveTab(page, 'timer', 'Timer');

  await touchSwipe(page, cdp, 'left');
  await expectActiveTab(page, 'picker', 'Picker');

  // Edge check: swiping left on the last tab stays on Picker with no leftover circles
  await touchSwipe(page, cdp, 'left');
  await expectActiveTab(page, 'picker', 'Picker');
  await expect(page.locator('#picker-circles .picker-circle')).toHaveCount(0);

  // Swipe backward through every tab: Picker -> Timer -> Dice -> Counters
  await touchSwipe(page, cdp, 'right');
  await expectActiveTab(page, 'timer', 'Timer');

  await touchSwipe(page, cdp, 'right');
  await expectActiveTab(page, 'dice', 'Dice');

  await touchSwipe(page, cdp, 'right');
  await expectActiveTab(page, 'counters', 'Counters');
});
