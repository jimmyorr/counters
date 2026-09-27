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

test.describe('zoom', () => {
  test('pinch zoom is not disabled', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
  });

  test('text fields are at least 16px so iOS does not zoom on focus', async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha')] });
    await page.goto('/');
    const fieldSizes = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('dialog[open] input, dialog[open] select, dialog[open] textarea')]
          .filter((el) => !['checkbox', 'radio', 'range', 'color'].includes(el.type))
          .map((el) => `${el.id}:${parseFloat(getComputedStyle(el).fontSize)}`),
      );
    const expectAll16 = async () => {
      const sizes = await fieldSizes();
      expect(sizes.length).toBeGreaterThan(0);
      for (const entry of sizes) expect(Number(entry.split(':')[1]), entry).toBeGreaterThanOrEqual(16);
    };

    await card(page, 'a').locator('.btn-counter-edit').click();
    await expectAll16();
    await page.keyboard.press('Escape');

    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-open-settings').click();
    await expectAll16();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  const T0 = new Date('2026-01-01T00:00:00');

  test('deleting skips the fly-away animation', async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha'), counter('b', 'Bravo')] });
    await page.clock.install({ time: T0 });
    await page.goto('/');
    await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

    await card(page, 'a').locator('.btn-counter-edit').click();
    await page.locator('#edit-btn-delete').click();
    await page.locator('#confirm-btn-ok').click();
    // Gone without advancing the clock through the 700ms animation
    await expect(card(page, 'a')).toHaveCount(0);

    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-delete-all').click();
    await page.locator('#confirm-btn-ok').click();
    await expect(page.locator('#empty-state-view')).toBeVisible();
  });

  test('shuffle does not animate cards', async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha'), counter('b', 'Bravo'), counter('c', 'Charlie')] });
    await page.goto('/');
    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-shuffle-counters').click();
    const transforms = await page
      .locator('.counter-card')
      .evaluateAll((cards) => cards.map((c) => c.style.transform));
    expect(transforms.every((t) => t === '')).toBe(true);
  });
});
