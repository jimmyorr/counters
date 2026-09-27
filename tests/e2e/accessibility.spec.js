import { test, expect } from './fixtures.js';
import { seed, counter, card } from './helpers.js';

test.describe('counter cards', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      counters: [counter('a', 'Alpha', 3, { increment: 5 }), counter('b', 'Bravo', 8)],
    });
    await page.goto('/');
  });

  test('controls name their counter, value, and step', async ({ page }) => {
    const alpha = card(page, 'a');
    await expect(alpha.getByRole('button', { name: 'Alpha: 3. Open calculator' })).toBeVisible();
    await expect(alpha.getByRole('button', { name: 'Add 5 to Alpha' })).toBeVisible();
    await expect(alpha.getByRole('button', { name: 'Subtract 5 from Alpha' })).toBeVisible();
    await expect(card(page, 'b').getByRole('button', { name: 'Add 1 to Bravo' })).toBeVisible();
  });

  test('announces the new value after a change', async ({ page }) => {
    await card(page, 'a').getByRole('button', { name: 'Add 5 to Alpha' }).click();
    await expect(page.locator('#sr-announcer')).toHaveText('Alpha: 8');
    await expect(page.locator('#sr-announcer')).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('toast', () => {
  test('is announced as a status message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#toast-wrapper')).toHaveAttribute('role', 'status');
  });

  test('keeps Undo available while it has focus', async ({ page }) => {
    const T0 = new Date('2026-01-01T00:00:00');
    await seed(page, { counters: [counter('a', 'Alpha')] });
    await page.clock.install({ time: T0 });
    await page.goto('/');
    await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

    await card(page, 'a').locator('.btn-counter-edit').click();
    await page.locator('#edit-btn-delete').click();
    await page.locator('#confirm-btn-ok').click();
    await page.clock.runFor(1000); // delete animation
    const undo = page.locator('#toast-action');
    await expect(undo).toBeVisible();

    await undo.focus();
    await page.clock.runFor(10_000); // well past the 5s timeout
    await expect(undo).toBeVisible();

    await undo.blur();
    await page.clock.runFor(5100);
    await expect(undo).toBeHidden();
  });
});

test.describe('color contrast', () => {
  const contrast = (page, locator) =>
    locator.evaluate((el) => {
      const rgba = (css) => {
        const [r, g, b, a = 1] = css.match(/[\d.]+/g).map(Number);
        return { rgb: [r, g, b], a };
      };
      const lum = ([r, g, b]) => {
        const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      // Composite translucent backgrounds (e.g. the card header's dark overlay)
      // down to the first opaque ancestor
      const layers = [];
      for (let node = el; node; node = node.parentElement) {
        const bg = rgba(getComputedStyle(node).backgroundColor);
        if (bg.a > 0) layers.push(bg);
        if (bg.a === 1) break;
      }
      const bg = layers.reverse().reduce(
        (under, { rgb, a }) => under.map((c, i) => rgb[i] * a + c * (1 - a)),
        [255, 255, 255],
      );
      const [a, b] = [lum(rgba(getComputedStyle(el).color).rgb), lum(bg)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });

  test('card labels meet 4.5:1 on every preset and a pale custom color', async ({ page }) => {
    const presets = Array.from({ length: 8 }, (_, i) => counter(`p${i}`, `Preset ${i}`, 0, { color: i }));
    await seed(page, { counters: [...presets, counter('pale', 'Pale', 0, { color: '#f5f0c8' })] });
    await page.goto('/');

    for (const id of [...presets.map((c) => c.id), 'pale']) {
      const ratio = await contrast(page, card(page, id).locator('.counter-label'));
      expect(ratio, `card ${id}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('calculator submit button is readable on a light counter color', async ({ page }) => {
    await seed(page, { counters: [counter('y', 'Yellow', 0, { color: 5 })] });
    await page.goto('/');
    await card(page, 'y').locator('.card-value-body').click();
    expect(await contrast(page, page.locator('#calc-btn-submit'))).toBeGreaterThanOrEqual(4.5);
  });
});
