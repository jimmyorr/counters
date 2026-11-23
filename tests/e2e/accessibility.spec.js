import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, labels, contrast, PALETTES, presets } from './helpers.js';

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

    await card(page, 'a').locator('.card-header').click();
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
  for (const palette of PALETTES) {
    test(`${palette}: every card uses one text color at 4.5:1 or better`, async ({ page }) => {
      await seed(page, { counters: presets(), settings: { palette } });
      await page.goto('/');

      const textColors = new Set();
      for (let i = 0; i < 8; i++) {
        const label = card(page, `p${i}`).locator('.counter-label');
        textColors.add(await label.evaluate((el) => getComputedStyle(el).color));
        expect(await contrast(label), `${palette} slot ${i}`).toBeGreaterThanOrEqual(4.5);
      }
      expect([...textColors], `${palette} mixes text colors`).toHaveLength(1);
    });
  }

  test('custom colors pick black or white text for contrast', async ({ page }) => {
    await seed(page, {
      counters: [counter('pale', 'Pale', 0, { color: '#f5f0c8' }), counter('dark', 'Dark', 0, { color: '#202040' })],
    });
    await page.goto('/');
    await expect(card(page, 'pale').locator('.counter-label')).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(card(page, 'dark').locator('.counter-label')).toHaveCSS('color', 'rgb(255, 255, 255)');
    for (const id of ['pale', 'dark']) {
      expect(await contrast(card(page, id).locator('.counter-label'))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('contrast tests cover every palette in the app', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-open-settings').click();
    const options = await page
      .locator('#setting-palette-group [data-palette-opt]')
      .evaluateAll((els) => els.map((b) => b.dataset.paletteOpt));
    expect(options).toEqual(PALETTES);
  });

  test('calculator submit button is readable on a light counter color', async ({ page }) => {
    await seed(page, { counters: [counter('y', 'Yellow', 0, { color: '#f5d547' })] });
    await page.goto('/');
    await card(page, 'y').locator('.card-value-body').click();
    expect(await contrast(page.locator('#calc-numpad-btn-add'))).toBeGreaterThanOrEqual(4.5);
  });

  for (const theme of ['light', 'dark']) {
    test(`${theme}: accent controls stay readable across custom theme hues`, async ({ page }) => {
      await seed(page, { counters: [counter('a', 'Alpha', 5)], settings: { theme } });
      await page.goto('/');
      await page.locator('[data-tab-btn="dice"]').click();
      await expect(page.locator('#btn-roll-action')).toBeVisible();
      await page.locator('#btn-roll-action').click();
      await expect(page.locator('#dice-result-card')).toHaveClass(/rolled/);

      const pipVsDie = () =>
        page.locator('#dice-shake-icon').evaluate((el) => {
          const lum = (css) => {
            const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map((v) => {
              const c = Number(v) / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const a = lum(getComputedStyle(el.querySelector('.accent-badge-fill')).fill);
          const b = lum(getComputedStyle(el.querySelector('.accent-badge-pip')).fill);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });

      const badgeFill = page.locator('#dice-shake-icon .accent-badge-fill');
      const badgePip = page.locator('#dice-shake-icon .accent-badge-pip').first();

      for (const hue of [0, 60, 120, 180, 205, 240, 258, 275, 300]) {
        await page.locator('#setting-theme-hue').evaluate((el, h) => {
          el.value = String(h);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          document.getAnimations().forEach((a) => a.finish());
        }, hue);
        const boundaryProp = (await badgeFill.evaluate((el) => getComputedStyle(el).stroke)) === 'none' ? 'fill' : 'stroke';
        expect(await contrast(page.locator('.nav-item.active')), `${theme} nav icon hue ${hue}`).toBeGreaterThanOrEqual(3);
        expect(await contrast(page.locator('.nav-item.active .nav-text')), `${theme} nav text hue ${hue}`).toBeGreaterThanOrEqual(4.5);
        expect(await contrast(page.locator('#btn-roll-action')), `${theme} primary btn hue ${hue}`).toBeGreaterThanOrEqual(4.5);
        expect(await contrast(page.locator('#dice-result-card'), 'borderTopColor'), `${theme} rolled border hue ${hue}`).toBeGreaterThanOrEqual(3);
        expect(await contrast(badgeFill, boundaryProp), `${theme} die boundary hue ${hue}`).toBeGreaterThanOrEqual(3);
        expect(await pipVsDie(), `${theme} die pips hue ${hue}`).toBeGreaterThanOrEqual(3);

        if (theme === 'light' && [0, 205, 240, 258, 275, 300].includes(hue)) {
          await expect(badgePip, `white pips hue ${hue}`).toHaveCSS('fill', 'rgb(255, 255, 255)');
          await expect(badgeFill, `rimless badge hue ${hue}`).toHaveCSS('stroke', 'none');
          const fillRgb = await badgeFill.evaluate((el) => getComputedStyle(el).fill);
          await expect(page.locator('.nav-item.active'), `matching nav icon hue ${hue}`).toHaveCSS('color', fillRgb);
        }
        if (theme === 'light' && [205, 240, 258, 275].includes(hue)) {
          await expect(page.locator('#btn-roll-action'), `white button text hue ${hue}`).toHaveCSS('color', 'rgb(255, 255, 255)');
        }
      }

      // Check outlined timer icon and 36px bold readout across red (0), default blue (205), and pale yellow (60)
      await page.locator('[data-tab-btn="timer"]').click();
      for (const timerHue of [0, 205, 60]) {
        await page.locator('#setting-theme-hue').evaluate((el, h) => {
          el.value = String(h);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          document.getAnimations().forEach((a) => a.finish());
        }, timerHue);
        expect(await contrast(page.locator('#timer-shake-icon')), `${theme} timer icon hue ${timerHue}`).toBeGreaterThanOrEqual(3);
        expect(await contrast(page.locator('#placeholder-stopwatch-display')), `${theme} timer readout hue ${timerHue}`).toBeGreaterThanOrEqual(3);
        if (theme === 'light' && [0, 205].includes(timerHue)) {
          const btnBg = await page.locator('#btn-timer-placeholder-start').evaluate((el) => getComputedStyle(el).backgroundColor);
          await expect(page.locator('#timer-shake-icon'), `matching timer icon hue ${timerHue}`).toHaveCSS('color', btnBg);
          await expect(page.locator('#placeholder-stopwatch-display'), `matching timer readout hue ${timerHue}`).toHaveCSS('color', btnBg);
        }
      }

      await page.locator('#btn-open-options').click();
      await page.locator('#menu-btn-open-display-options').click();
      await expect(page.locator('#layout-opt-list')).toBeVisible();
      expect(await contrast(page.locator('#layout-opt-list'))).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press('Escape');

      await page.locator('#btn-open-options').click();
      await page.locator('#menu-btn-open-settings').click();
      await expect(page.locator('#settings-dialog')).toBeVisible();
      await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
      expect(await contrast(page.locator('#setting-theme-group .segment-btn.active')), `${theme} active segment hue 60`).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.locator('#setting-palette-group .palette-option-card.active .palette-option-name')), `${theme} active palette text hue 60`).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.locator('#setting-palette-group .palette-option-card.active'), 'borderTopColor'), `${theme} active palette border hue 60`).toBeGreaterThanOrEqual(3);
    });

    test(`${theme}: destructive menu and confirm buttons meet 4.5:1`, async ({ page }) => {
      await seed(page, { counters: [counter('a', 'Alpha', 5)], settings: { theme } });
      await page.goto('/');
      await page.locator('#btn-open-options').click();
      await expect(page.locator('#menu-btn-delete-all')).toBeVisible();
      expect(await contrast(page.locator('#menu-btn-delete-all'))).toBeGreaterThanOrEqual(4.5);

      await page.locator('#menu-btn-delete-all').click();
      await expect(page.locator('#confirm-btn-ok')).toBeVisible();
      expect(await contrast(page.locator('#confirm-btn-ok'))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

test.describe('keyboard navigation and non-drag reordering', () => {
  test('tabs expose WAI-ARIA roles, inert off-screen panels, and arrow key switching', async ({ page }) => {
    await page.goto('/');
    const countersTab = page.locator('[data-tab-btn="counters"]');
    const diceTab = page.locator('[data-tab-btn="dice"]');
    const timerTab = page.locator('[data-tab-btn="timer"]');
    const pickerTab = page.locator('[data-tab-btn="picker"]');

    await expect(countersTab).toHaveAttribute('aria-selected', 'true');
    await expect(countersTab).toHaveAttribute('tabindex', '0');
    await expect(diceTab).toHaveAttribute('tabindex', '-1');
    await expect(timerTab).toHaveAttribute('tabindex', '-1');
    await expect(pickerTab).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#tab-counters')).toHaveJSProperty('inert', false);
    await expect(page.locator('#tab-dice')).toHaveJSProperty('inert', true);
    await expect(page.locator('#tab-timer')).toHaveJSProperty('inert', true);
    await expect(page.locator('#tab-picker')).toHaveJSProperty('inert', true);

    await countersTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(diceTab).toBeFocused();
    await expect(diceTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-dice')).toHaveJSProperty('inert', false);
    await expect(page.locator('#tab-counters')).toHaveJSProperty('inert', true);

    await page.keyboard.press('End');
    await expect(pickerTab).toBeFocused();
    await expect(page.locator('#tab-picker')).toHaveJSProperty('inert', false);

    await page.keyboard.press('Home');
    await expect(countersTab).toBeFocused();
    await expect(page.locator('#tab-counters')).toHaveJSProperty('inert', false);
  });

  test('preset color swatches are keyboard-operable buttons with names and pressed state', async ({ page }) => {
    await seed(page, { counters: [counter('a', 'Alpha', 0, { color: 0 })] });
    await page.goto('/');
    await card(page, 'a').locator('.card-header').click();

    const swatches = page.locator('#edit-palette-container button.palette-swatch');
    await expect(swatches).toHaveCount(8);
    const active = page.locator('#edit-palette-container button.palette-swatch[data-color-id="0"]');
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await expect(active).toHaveAttribute('aria-label', /.+/);

    const other = page.locator('#edit-palette-container button.palette-swatch[data-color-id="4"]');
    await other.focus();
    await page.keyboard.press('Space');
    await expect(other).toHaveAttribute('aria-pressed', 'true');
    await expect(active).toHaveAttribute('aria-pressed', 'false');
  });

  test('counters can be reordered without dragging from the edit dialog (#23)', async ({ page }) => {
    await seed(page, {
      counters: [counter('a', 'Alpha'), counter('b', 'Bravo'), counter('c', 'Charlie')],
    });
    await page.goto('/');
    await card(page, 'a').locator('.card-header').click();

    const up = page.locator('#edit-btn-move-up');
    const down = page.locator('#edit-btn-move-down');
    await expect(page.locator('#edit-reorder-row')).toBeVisible();
    await expect(up).toBeDisabled();
    await expect(down).toBeEnabled();

    await down.focus();
    await page.keyboard.press('Enter');
    await expect(labels(page)).toHaveText(['Bravo', 'Alpha', 'Charlie']);
    await expect(up).toBeEnabled();
    await expect(down).toBeEnabled();

    await page.keyboard.press('Enter');
    await expect(labels(page)).toHaveText(['Bravo', 'Charlie', 'Alpha']);
    await expect(down).toBeDisabled();
    // Focus shifts to Move up instead of dropping to body when Move down hits the end
    await expect(up).toBeFocused();
    await expect(page.locator('#sr-announcer')).toHaveText('Alpha moved to position 3 of 3');

    await page.keyboard.press('Escape');
    await page.reload();
    await expect(labels(page)).toHaveText(['Bravo', 'Charlie', 'Alpha']);
    expect((await stored(page, 'counters-list')).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  test('reorder controls stay hidden when auto-sort is enabled', async ({ page }) => {
    await seed(page, {
      counters: [counter('a', 'Alpha', 10), counter('b', 'Bravo', 5)],
      settings: { autoSort: true },
    });
    await page.goto('/');
    await card(page, 'a').locator('.card-header').click();
    await expect(page.locator('#edit-reorder-row')).toBeHidden();
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

    await card(page, 'a').locator('.card-header').click();
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

    await card(page, 'a').locator('.card-header').click();
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

test('every dialog has an accessible name', async ({ page }) => {
  await page.goto('/');
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('dialog')]
      .filter((d) => {
        const id = d.getAttribute('aria-labelledby');
        return !d.getAttribute('aria-label') && !(id && document.getElementById(id)?.textContent.trim());
      })
      .map((d) => d.id),
  );
  expect(unnamed).toEqual([]);
});

// #27: the color-blind palette only earns its name if every pair of colors stays
// distinct under the common color vision deficiencies
test('color-blind friendly palette stays distinct under color blindness', async ({ page }) => {
  const counters = Array.from({ length: 8 }, (_, i) => counter(`p${i}`, `Preset ${i}`, 0, { color: i }));
  await seed(page, { counters, settings: { palette: 'colorblind' } });
  await page.goto('/');
  const colors = await page.locator('#counters-list-wrapper .counter-card').evaluateAll((cards) =>
    cards.map((c) => getComputedStyle(c).backgroundColor.match(/\d+/g).slice(0, 3).map((v) => v / 255)),
  );
  expect(colors).toHaveLength(8);

  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const unlin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  // Machado et al. (2009) simulation matrices, full severity, in linear RGB
  const CVD = {
    deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  const simulate = (rgb, m) => {
    const l = rgb.map(lin);
    return m.map((row) => unlin(Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))));
  };
  const oklab = (rgb) => {
    const [r, g, b] = rgb.map(lin);
    const [l, m, s] = [
      0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
      0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
      0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
    ].map(Math.cbrt);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const distance = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i])) * 100;

  for (const [kind, matrix] of [['normal vision', null], ...Object.entries(CVD)]) {
    const seen = matrix ? colors.map((c) => simulate(c, matrix)) : colors;
    let worst = Infinity;
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) worst = Math.min(worst, distance(seen[i], seen[j]));
    // Other palettes drop to roughly 2-7 under color blindness; this one must stay well clear
    expect(worst, kind).toBeGreaterThanOrEqual(9);
  }
});
