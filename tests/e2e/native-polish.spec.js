import { test, expect } from './fixtures.js';
import { seed, counter, card } from './helpers.js';

const openSettings = async (page) => {
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
};

test.describe('bottom sheet physics', () => {
  test('a short brisk downward flick dismisses a sheet below the 100px distance threshold', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);

    const header = page.locator('#settings-dialog .bottom-sheet-header');
    const box = await header.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Dispatch rapid pointer events (~60px in 30ms = 2.0 px/ms > 0.55 px/ms, distance < 100px)
    await header.evaluate((el, { startX, startY }) => {
      const fire = (type, clientY, timeStamp) => {
        const ev = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: startX,
          clientY,
        });
        Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
        el.dispatchEvent(ev);
      };
      fire('pointerdown', startY, 1000);
      fire('pointermove', startY + 20, 1010);
      fire('pointermove', startY + 42, 1020);
      fire('pointermove', startY + 60, 1030);
      fire('pointerup', startY + 60, 1032);
    }, { startX: x, startY: y });

    await expect(page.locator('#settings-dialog')).toBeHidden();
  });

  test('a slow short downward drag snaps back open', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);

    const header = page.locator('#settings-dialog .bottom-sheet-header');
    const box = await header.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // 55px over 600ms (~0.09 px/ms) is neither >100px nor >0.55 px/ms
    await header.evaluate((el, { startX, startY }) => {
      const fire = (type, clientY, timeStamp) => {
        const ev = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: startX,
          clientY,
        });
        Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
        el.dispatchEvent(ev);
      };
      fire('pointerdown', startY, 1000);
      fire('pointermove', startY + 25, 1300);
      fire('pointermove', startY + 55, 1600);
      fire('pointerup', startY + 55, 1650);
    }, { startX: x, startY: y });

    await expect(page.locator('#settings-dialog')).toBeVisible();
    expect(await page.locator('#settings-dialog').evaluate((el) => el.style.transform)).toBe('');
  });

  test('dragging upward applies damped rubber-band resistance and snaps back', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);

    const dialog = page.locator('#settings-dialog');
    const header = dialog.locator('.bottom-sheet-header');
    const box = await header.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 6 });

    const transformDuringDrag = await dialog.evaluate((el) => el.style.transform);
    const match = transformDuringDrag.match(/translate\(-50%,\s*(-?\d+(?:\.\d+)?)px\)/);
    expect(match).not.toBeNull();
    const offsetY = Number(match[1]);
    expect(offsetY).toBeLessThan(0);
    expect(offsetY).toBeGreaterThan(-50); // damped rubber-band ceiling

    await page.mouse.up();
    expect(await dialog.evaluate((el) => el.style.transform)).toBe('');
    await expect(dialog).toBeVisible();
  });

  test('pulling down inside sheet body dismisses when scrolled to top, but not when scrolled down', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await page.goto('/');
    await openSettings(page);

    const dialog = page.locator('#settings-dialog');
    const body = dialog.locator('.bottom-sheet-body');
    const infoTitle = dialog.locator('.setting-title').first();
    const box = await infoTitle.boundingBox();
    const x = box.x + 20;
    const y = box.y + box.height / 2;

    // When scrolled down (scrollTop > 0), pulling down does NOT drag-dismiss the dialog
    await body.evaluate((el) => { el.scrollTop = 80; });
    expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await body.evaluate((el, { startX, startY }) => {
      const fire = (type, clientY, timeStamp) => {
        const ev = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 2,
          pointerType: 'touch',
          isPrimary: true,
          clientX: startX,
          clientY,
        });
        Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
        el.dispatchEvent(ev);
      };
      fire('pointerdown', startY, 2000);
      fire('pointermove', startY + 30, 2020);
      fire('pointermove', startY + 140, 2060);
      fire('pointerup', startY + 140, 2080);
    }, { startX: x, startY: y });

    await expect(dialog).toBeVisible();

    // Scroll back to top (scrollTop === 0): pulling down on non-interactive body content dismisses
    await body.evaluate((el) => { el.scrollTop = 0; });
    await infoTitle.evaluate((el, { startX, startY }) => {
      const fire = (type, clientY, timeStamp) => {
        const ev = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 3,
          pointerType: 'touch',
          isPrimary: true,
          clientX: startX,
          clientY,
        });
        Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
        el.dispatchEvent(ev);
      };
      fire('pointerdown', startY, 3000);
      fire('pointermove', startY + 20, 3020); // crosses >10px pull threshold
      fire('pointermove', startY + 140, 3100); // >100px downward offset
      fire('pointerup', startY + 140, 3120);
    }, { startX: x, startY: y });

    await expect(dialog).toBeHidden();
  });
});

test.describe('native back navigation and radiogroup controls', () => {
  test('back navigation closes stacked dialogs in LIFO order, then returns from Dice/Timer to Counters', async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha', 5)] });
    await page.goto('/');

    // Switch to Dice tab first, then open options -> settings? Even better: test stacked Edit + Confirm!
    await card(page, 'a').locator('.card-header').click();
    await expect(page.locator('#edit-counter-dialog')).toBeVisible();
    await page.locator('#edit-btn-delete').click();
    await expect(page.locator('#confirm-dialog')).toBeVisible();

    // 1st back event closes topmost #confirm-dialog, leaving #edit-counter-dialog open
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('counters:back')));
    await expect(page.locator('#confirm-dialog')).toBeHidden();
    await expect(page.locator('#edit-counter-dialog')).toBeVisible();

    // 2nd back event closes #edit-counter-dialog
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('counters:back')));
    await expect(page.locator('#edit-counter-dialog')).toBeHidden();

    // Navigate to Timer tab; 3rd back event returns to Counters tab
    await page.locator('[data-tab-btn="timer"]').click();
    await expect(page.locator('[data-tab-btn="timer"]')).toHaveAttribute('aria-selected', 'true');

    await page.evaluate(() => document.dispatchEvent(new CustomEvent('counters:back')));
    await expect(page.locator('[data-tab-btn="counters"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('back closes the most recently opened dialog even when it comes earlier in the page', async ({ page }) => {
    // #confirm-dialog sits before #history-dialog in the markup, so picking the
    // last open dialog in document order would close History underneath
    await seed(page, {
      counters: [counter('a', 'Alpha', 5)],
      history: [{ id: 'h1', counterLabel: 'Alpha', color: 0, actionLabel: '+1', time: Date.now() }],
    });
    await page.goto('/');

    await page.locator('#btn-open-history').click();
    await expect(page.locator('#history-dialog')).toBeVisible();
    await page.locator('#history-btn-clear').click();
    await expect(page.locator('#confirm-dialog')).toBeVisible();

    await page.evaluate(() => document.dispatchEvent(new CustomEvent('counters:back')));
    await expect(page.locator('#confirm-dialog')).toBeHidden();
    await expect(page.locator('#history-dialog')).toBeVisible();
    // Backing out of the confirm must not clear anything
    await expect(page.locator('#history-items-wrapper > *')).not.toHaveCount(0);

    await page.evaluate(() => document.dispatchEvent(new CustomEvent('counters:back')));
    await expect(page.locator('#history-dialog')).toBeHidden();
  });

  test('theme segmented control and palette grid support arrow-key radiogroup navigation', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);

    const sysBtn = page.locator('#setting-theme-group [data-theme-opt="system"]');
    const darkBtn = page.locator('#setting-theme-group [data-theme-opt="dark"]');
    const lightBtn = page.locator('#setting-theme-group [data-theme-opt="light"]');

    await expect(sysBtn).toHaveAttribute('aria-checked', 'true');
    await expect(sysBtn).toHaveAttribute('tabindex', '0');
    await expect(darkBtn).toHaveAttribute('tabindex', '-1');

    await sysBtn.focus();
    await page.keyboard.press('ArrowRight');
    await expect(darkBtn).toBeFocused();
    await expect(darkBtn).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveClass(/dark-mode/);

    await page.keyboard.press('ArrowRight');
    await expect(lightBtn).toBeFocused();
    await expect(lightBtn).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveClass(/light-mode/);

    const boldCard = page.locator('#setting-palette-group [data-palette-opt="bold"]');
    const pastelCard = page.locator('#setting-palette-group [data-palette-opt="pastel"]');
    await boldCard.focus();
    await page.keyboard.press('ArrowRight');
    await expect(pastelCard).toBeFocused();
    await expect(pastelCard).toHaveAttribute('aria-checked', 'true');
  });

  test('drag-reorder animates displaced neighbors with FLIP and strips data-counter-id from ghost', async ({ page }) => {
    await seed(page, {
      counters: [counter('a', 'Alpha'), counter('b', 'Bravo'), counter('c', 'Charlie')],
    });
    await page.goto('/');

    const box = await card(page, 'a').locator('.counter-label').boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(450);

    await expect(page.locator('.drag-ghost')).toHaveCount(1);
    // Ghost does not duplicate data-counter-id="a"
    await expect(card(page, 'a')).toHaveCount(1);

    const target = await card(page, 'b').boundingBox();
    await page.mouse.move(x, target.y + target.height - 4, { steps: 6 });

    // Bravo was displaced upward and has a live FLIP Web Animation running
    const bravoAnimations = await card(page, 'b').evaluate((el) => el.getAnimations().length);
    expect(bravoAnimations).toBeGreaterThanOrEqual(1);

    await page.mouse.up();
    await expect(page.locator('.drag-ghost, .drag-placeholder')).toHaveCount(0);
  });
});
