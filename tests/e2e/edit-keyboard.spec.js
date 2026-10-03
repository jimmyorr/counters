import { test, expect } from './fixtures.js';
import { seed, counter, card } from './helpers.js';

// The edit sheet fills the space above the software keyboard (issue #37).
// Playwright can't open a real keyboard, so these shrink the viewport the way
// the native Keyboard plugin shrinks the web view.

const dialog = (page) => page.locator('#edit-counter-dialog');
const KEYBOARD = 260; // iPhone SE keyboard with suggestions, in CSS px

const openEdit = async (page) => {
  await card(page, 'a').locator('.card-header').click();
  await expect(dialog(page)).toBeVisible();
};

const geometry = (page) =>
  dialog(page).evaluate((d) => {
    const box = d.getBoundingClientRect();
    const body = d.querySelector('.bottom-sheet-body');
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      scrolls: body.scrollHeight > body.clientHeight,
      viewportBottom: window.innerHeight,
    };
  });

// Skip the sheet's slide-up so measurements see its final position
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await seed(page, { counters: [counter('a', 'Alpha')] });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('fills the space above the keyboard without scrolling', async ({ page }) => {
    await page.goto('/');
    await openEdit(page);
    await page.locator('#edit-label').focus();
    await page.setViewportSize({ width: 375, height: 667 - KEYBOARD });

    await expect(page.locator('html')).toHaveClass(/keyboard-open/);
    const { top, bottom, scrolls, viewportBottom } = await geometry(page);
    expect(bottom).toBe(viewportBottom);
    expect(top).toBeLessThanOrEqual(8);
    expect(scrolls).toBe(false);
    await expect(page.locator('#edit-btn-save')).toBeInViewport();
  });

  test('goes back to its natural height when the keyboard closes', async ({ page }) => {
    await page.goto('/');
    await openEdit(page);
    await page.locator('#edit-label').focus();
    await page.setViewportSize({ width: 375, height: 667 - KEYBOARD });
    await expect(page.locator('html')).toHaveClass(/keyboard-open/);

    await page.locator('#edit-label').blur();
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
    const { top, bottom, viewportBottom } = await geometry(page);
    expect(bottom).toBe(viewportBottom);
    expect(top).toBeGreaterThan(200); // content-sized, not full height
  });
});

test.describe('on desktop', () => {
  test.use({ viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false });

  test('a shorter window is not mistaken for a keyboard', async ({ page }) => {
    await page.goto('/');
    await openEdit(page);
    await page.locator('#edit-label').focus();
    await page.setViewportSize({ width: 1200, height: 500 });
    await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
  });
});
