import { test, expect } from './fixtures.js';

// #28: help text must never run under a row's dropdown or switch
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
          const control = row.querySelector(':scope > select, :scope > .switch-toggle');
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
    // Palette preview dots stay circles rather than squeezing into ovals
    const dots = await page.locator('#setting-palette-preview span').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - r.height); }),
    );
    expect(Math.max(...dots), `palette dots at ${width}px`).toBeLessThan(0.5);
  }
});
