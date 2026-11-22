import { test, expect } from './fixtures.js';

// #28: help text must never run under a row's dropdown, segmented control, or switch
test('settings text stays clear of each row\'s control', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();

  for (const width of [320, 360, 375, 390, 412, 600, 900]) {
    await page.setViewportSize({ width, height: 800 });
    const rows = await page.locator('#settings-dialog .settings-row').evaluateAll((rows) =>
      rows
        .map((row) => {
          const control = row.querySelector(':scope > select, :scope > .switch-toggle, :scope > .segmented-control');
          const info = row.querySelector('.settings-info');
          if (!control || !info || !control.offsetParent) return null;
          // Measure the rendered text itself, not its box
          const range = document.createRange();
          range.selectNodeContents(info);
          const textRight = Math.max(...[...range.getClientRects()].map((r) => r.right));
          return {
            title: info.querySelector('.setting-title').textContent.trim(),
            gap: Math.round(control.getBoundingClientRect().left - textRight),
          };
        })
        .filter(Boolean),
    );
    expect(rows.length).toBeGreaterThan(2);
    for (const { title, gap } of rows) {
      expect(gap, `${title} at ${width}px`).toBeGreaterThanOrEqual(12);
    }
    // Palette preview dots across all 6 cards stay circles rather than squeezing into ovals
    const dots = await page.locator('.palette-picker-grid .palette-preview span').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - r.height); }),
    );
    expect(dots.length).toBe(48);
    expect(Math.max(...dots), `palette dots at ${width}px`).toBeLessThan(0.5);
  }
});

test('haptic feedback setting is visible and toggleable on browsers supporting vibrate', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();

  const row = page.locator('#setting-row-haptic');
  const toggle = page.locator('#setting-haptic');
  await expect(row).toBeVisible();
  await expect(toggle).toBeChecked();

  await row.locator('.switch-toggle').click();
  await expect(toggle).not.toBeChecked();
});

test('haptic feedback setting is hidden on browsers without vibrate support', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto('/');
  await page.locator('#btn-open-options').click();
  await page.locator('#menu-btn-open-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();

  await expect(page.locator('#setting-row-haptic')).toBeHidden();
});


test.describe('without a touchscreen', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 800 } });

  test('haptic feedback setting is hidden on desktop browsers even though vibrate exists', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => typeof navigator.vibrate)).toBe('function');
    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-open-settings').click();
    await expect(page.locator('#settings-dialog')).toBeVisible();
    await expect(page.locator('#setting-row-haptic')).toBeHidden();
  });

  test('picker explains it needs a touchscreen', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-tab-btn="picker"]').click();
    await expect(page.locator('#picker-prompt-subtitle')).toHaveText('Needs a touchscreen');
  });
});

test('tab switches give a short selection buzz on the web', async ({ page }) => {
  await page.addInitScript(() => {
    window.__vibrations = [];
    Navigator.prototype.vibrate = function (pattern) {
      window.__vibrations.push(pattern);
      return true;
    };
  });
  await page.goto('/');
  await page.locator('[data-tab-btn="dice"]').click();
  await expect.poll(() => page.evaluate(() => window.__vibrations)).toContain(8);
});
