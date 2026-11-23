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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha')] });
  });

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

  test('one tap on Save saves, without the keyboard closing first', async ({ page }) => {
    await page.goto('/');
    await openEdit(page);
    await page.locator('#edit-label').fill('Ace');
    await page.setViewportSize({ width: 375, height: 667 - KEYBOARD });
    await expect(page.locator('html')).toHaveClass(/keyboard-open/);

    // Pressing Save must not blur the field: on iOS the keyboard would start
    // closing, the sheet would move mid-tap, and the tap would be dropped
    const sheet = await dialog(page).boundingBox();
    const save = await page.locator('#edit-btn-save').boundingBox();
    await page.mouse.move(save.x + save.width / 2, save.y + save.height / 2);
    await page.mouse.down();
    await expect(page.locator('#edit-label')).toBeFocused();
    await expect(page.locator('html')).toHaveClass(/keyboard-open/);
    expect(await dialog(page).boundingBox()).toEqual(sheet);

    await page.mouse.up();
    await expect(dialog(page)).toBeHidden();
    await expect(card(page, 'a').locator('.counter-label')).toHaveText('Ace');
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

  test('still fits without scrolling when reorder controls are shown', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-add-counter').click();
    await openEdit(page);
    await expect(page.locator('#edit-reorder-row')).toBeVisible();

    await page.locator('#edit-label').focus();
    await page.setViewportSize({ width: 375, height: 667 - KEYBOARD });
    await expect(page.locator('html')).toHaveClass(/keyboard-open/);
    const { scrolls } = await geometry(page);
    expect(scrolls).toBe(false);
    await expect(page.locator('#edit-btn-save')).toBeInViewport();
  });
});

test.describe('background stability behind keyboard sheets', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test('keeps background counter cards completely still behind blurred dialogs when the keyboard opens', async ({ page }) => {
    await seed(page, {
      counters: [
        counter('d', 'Daddy', 12, { color: 0 }),
        counter('m', 'Mommy', 7, { color: 7 }),
        counter('mi', 'Miles', 8, { color: 6 }),
        counter('o', 'Oliver', 11, { color: 5 }),
      ],
    });
    await page.goto('/');

    const cardRects = () =>
      page.locator('#counters-list-wrapper .counter-card').evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.counterId, top: Math.round(r.top), height: Math.round(r.height) };
        }),
      );

    const before = await cardRects();
    expect(before).toHaveLength(4);
    expect(before[0].height).toBeGreaterThan(140);

    // Long-press Mommy's value body to open #edit-value-dialog and shrink viewport for numeric keypad
    const mommyBody = await card(page, 'm').locator('.card-value-body').boundingBox();
    await page.mouse.move(mommyBody.x + mommyBody.width / 2, mommyBody.y + mommyBody.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();
    await expect(page.locator('#edit-value-dialog')).toBeVisible();
    await expect(page.locator('#edit-value-input')).toBeFocused();

    // The long-press shrinks Mommy's card (scale 0.985) and it springs back over
    // 0.4s. That's press feedback, not layout movement, so let it settle first
    await expect
      .poll(() =>
        page
          .locator('#counters-list-wrapper .counter-card')
          .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform)),
      )
      .toEqual(['none', 'none', 'none', 'none']);

    await page.setViewportSize({ width: 393, height: 852 - 290 });
    await expect(page.locator('html')).toHaveClass(/keyboard-open/);
    await expect(page.locator('html')).toHaveClass(/viewport-locked/);

    // Cards behind the frosted backdrop must not smoosh or move upward
    expect(await cardRects()).toEqual(before);

    // Tapping Save in #edit-value-dialog works in a single tap without closing keyboard first,
    // and keeps background cards locked while the keyboard is still sliding closed
    await page.locator('#edit-value-dialog button[type="submit"]').click();
    await expect(page.locator('#edit-value-dialog')).toBeHidden();
    expect(await cardRects()).toEqual(before);

    // Once the native keyboard finishes restoring the WebView height, lock releases seamlessly
    await page.setViewportSize({ width: 393, height: 852 });
    await expect(page.locator('html')).not.toHaveClass(/viewport-locked/);
    expect(await cardRects()).toEqual(before);
  });
});

test.describe('on desktop', () => {
  test.use({ viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false });

  test.beforeEach(async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha')] });
  });

  test('a shorter window is not mistaken for a keyboard', async ({ page }) => {
    await page.goto('/');
    await openEdit(page);
    await page.locator('#edit-label').focus();
    await page.setViewportSize({ width: 1200, height: 500 });
    await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
  });
});

test.describe('settings sheet with the keyboard up', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test('scrolls the quick-add values field into view above the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-open-settings').click();
    await expect(page.locator('#settings-dialog')).toHaveJSProperty('open', true);

    const field = page.locator('#setting-quick-add-values');
    await field.focus();
    await page.setViewportSize({ width: 393, height: 852 - 330 });
    await expect(page.locator('html')).toHaveClass(/keyboard-open/);
    await expect(field).toBeInViewport({ ratio: 1 });
  });
});
