import { test, expect } from './fixtures.js';

// iOS keeps :hover on the last element tapped until the next tap elsewhere,
// so hover styles must sit behind @media (hover: hover) or they stick after a
// tap (e.g. the stopwatch button kept its glow after pausing).

const start = (page) => page.locator('#btn-timer-placeholder-start');

const openTimer = async (page) => {
  await page.goto('/');
  await page.locator('[data-tab-btn="timer"]').click();
};

test.describe('on a touch screen', () => {
  // Hold the running stopwatch's pulse still so the button's look can be compared
  test.use({ reducedMotion: 'reduce' });

  test('a tapped button does not keep its hover styles', async ({ page }) => {
    await openTimer(page);
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    // Read the button's look once its transitions settle
    const look = () =>
      start(page).evaluate(async (el) => {
        const transitions = el.getAnimations().filter((a) => a instanceof CSSTransition);
        await Promise.all(transitions.map((a) => a.finished.catch(() => {})));
        const { boxShadow, opacity, backgroundColor } = getComputedStyle(el);
        return { boxShadow, opacity, backgroundColor };
      });

    for (const label of ['Pause', 'Start']) {
      await start(page).tap();
      await expect(start(page)).toHaveText(label);
      const afterTap = await look();
      // Tapping elsewhere is what cleared the stuck glow on iOS
      await page.locator('#placeholder-stopwatch-display').tap();
      expect(afterTap, `${label} button right after the tap`).toEqual(await look());
    }
  });
});

test.describe('with a mouse', () => {
  test.use({ isMobile: false, hasTouch: false });

  test('buttons still glow on hover', async ({ page }) => {
    await openTimer(page);
    await start(page).hover();
    await expect(start(page)).not.toHaveCSS('box-shadow', 'none');
  });
});
