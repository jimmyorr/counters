import { test, expect } from './fixtures.js';

// iOS keeps :hover on the last element tapped until the next tap elsewhere,
// so hover styles must sit behind @media (hover: hover) or they stick after a
// tap (e.g. the stopwatch button kept its glow after pausing).

const start = (page) => page.locator('#btn-timer-placeholder-start');

const openTimer = async (page) => {
  await page.goto('/');
  await page.locator('[data-tab-btn="timer"]').click();
};

test('a tapped button does not keep its hover glow on touch screens', async ({ page }) => {
  await openTimer(page);
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
  // Read the shadow once the button's transitions settle
  const shadow = () =>
    start(page).evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
      return getComputedStyle(el).boxShadow;
    });

  for (const label of ['Pause', 'Start']) {
    await start(page).tap();
    await expect(start(page)).toHaveText(label);
    const afterTap = await shadow();
    // Tapping elsewhere is what cleared the stuck glow on iOS
    await page.locator('#placeholder-stopwatch-display').tap();
    expect(afterTap, `${label} button right after the tap`).toBe(await shadow());
  }
});

test.describe('with a mouse', () => {
  test.use({ isMobile: false, hasTouch: false });

  test('buttons still glow on hover', async ({ page }) => {
    await openTimer(page);
    await start(page).hover();
    await expect(start(page)).not.toHaveCSS('box-shadow', 'none');
  });
});
