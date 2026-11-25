import { test, expect } from './fixtures.js';
import { seed, stored, counter } from './helpers.js';
import {
  CANDIDATE_PALETTES,
  auditPalette,
  generateTonalPalette,
  generateShufflePalette,
  generateSkyPalette,
  getAllLabPalettes,
  formatPaletteForCounters,
} from '../../palettes-candidates.js';

test('candidate and dynamic palettes meet WCAG AA on card bodies and 12% headers', () => {
  expect(getAllLabPalettes()).toHaveLength(24);

  for (const [id, pal] of Object.entries(CANDIDATE_PALETTES)) {
    const audit = auditPalette(pal.colors);
    expect(audit.passesWcagAA, `${id} contrast`).toBe(true);
    expect(audit.minPairwiseDeltaE, `${id} ΔE`).toBeGreaterThanOrEqual(5.8);
  }

  for (let hue = 0; hue < 360; hue += 30) {
    expect(auditPalette(generateTonalPalette({ hue, mode: 'analogous' }).colors).passesWcagAA).toBe(true);
    expect(auditPalette(generateTonalPalette({ hue, mode: 'monochromatic' }).colors).passesWcagAA).toBe(true);
  }

  for (let i = 0; i < 12; i++) {
    const seedStr = `S${i}A9F`;
    expect(auditPalette(generateShufflePalette({ seed: seedStr, style: 'vivid' }).colors).passesWcagAA).toBe(true);
    expect(auditPalette(generateShufflePalette({ seed: seedStr, style: 'luminous' }).colors).passesWcagAA).toBe(true);
  }

  for (let mins = 0; mins < 1440; mins += 60) {
    const sky = generateSkyPalette({ minutes: mins });
    const audit = auditPalette(sky.colors);
    expect(audit.passesWcagAA).toBe(true);
    expect(audit.isUniformText).toBe(true);
  }

  const exported = formatPaletteForCounters(getAllLabPalettes().find((p) => p.id === 'jewel'));
  expect(exported).toContain('PALETTE_INSTRUMENTS entry');
  expect(exported).toContain('crystal-harp');
});

test('debug.html drives the live Counters iframe without touching saved storage', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 860 });
  await seed(page, {
    counters: [counter('real', 'Saved real counter', 99)],
  });

  await page.addInitScript(() => {
    window.__oscTypes = [];
    const OrigCtx = window.AudioContext || window.webkitAudioContext;
    if (OrigCtx) {
      const origCreateOsc = OrigCtx.prototype.createOscillator;
      OrigCtx.prototype.createOscillator = function (...args) {
        const osc = origCreateOsc.apply(this, args);
        const origStart = osc.start.bind(osc);
        osc.start = (...startArgs) => {
          window.__oscTypes.push(osc.type);
          return origStart(...startArgs);
        };
        return osc;
      };
    }
  });

  await page.goto('/debug.html');
  await expect(page).toHaveTitle('Debug — Counters');
  await expect(page.locator('.studio-title')).toHaveText('Debug');
  await expect(page.locator('#palette-catalog-grid [data-palette-id]')).toHaveCount(24);
  await expect(page.locator('#swatch-values-grid [data-swatch-slot]')).toHaveCount(8);

  const frame = page.frameLocator('#counters-iframe');
  await expect(frame.locator('#counters-list-wrapper .counter-card')).toHaveCount(8);
  await expect(frame.locator('#header-leader-text')).toHaveText('Crane');

  // Switch to Thermal and Heat 1-8 preset -> updates real Counters cards & plays Thermal synth chime
  const childFrame = () => page.frames().find((f) => f.url().includes('lab=1'));
  await childFrame().evaluate(() => {
    window.__oscTypes = [];
  });

  await page.locator('[data-palette-id="thermal"]').click();
  await expect(page).toHaveURL(/#thermal$/);
  await expect(page.locator('#instrument-name')).toHaveText('Thermal synth');
  const oscTypes = await childFrame().evaluate(() => window.__oscTypes);
  expect(oscTypes).toHaveLength(6);
  expect(oscTypes).toContain('sawtooth');

  await page.locator('[data-preset="heat"]').click();
  await page.locator('[data-label-mode="colors"]').click();
  await expect(frame.locator('#header-leader-text')).toHaveText('White-hot');

  // Open the real Calculator inside the iframe, then live-switch palette to Risograph
  await frame.locator('.counter-card').first().locator('.card-value-body').click();
  await expect(frame.locator('#calculator-dialog')).toBeVisible();
  await page.locator('[data-palette-id="risograph"]').click();
  const sheetTheme = await frame
    .locator('#calculator-dialog')
    .evaluate((el) => el.style.getPropertyValue('--sheet-theme'));
  expect(sheetTheme).toBe('#5ec2ff');

  // Dynamic Tonal reacts to Theme color slider
  await page.locator('[data-palette-id="tonal"]').click();
  const beforeCardBg = await frame
    .locator('.counter-card')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.locator('#studio-theme-hue').fill('25');
  await page.locator('#studio-theme-hue').dispatchEvent('input');
  const afterCardBg = await frame
    .locator('.counter-card')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(afterCardBg).not.toBe(beforeCardBg);

  // Segmented Sound Off / On control mutes and restores audio unambiguously
  await page.locator('#sound-mode-group [data-sound-mode="off"]').click();
  await expect(page.locator('#sound-mode-group [data-sound-mode="off"]')).toHaveAttribute('aria-pressed', 'true');
  await childFrame().evaluate(() => {
    window.__oscTypes = [];
  });
  await page.locator('#btn-audition-chime').click();
  expect(await childFrame().evaluate(() => window.__oscTypes)).toHaveLength(0);

  await page.locator('#sound-mode-group [data-sound-mode="on"]').click();
  expect((await childFrame().evaluate(() => window.__oscTypes)).length).toBe(6);

  // Laptop click-to-pin on #picker-stage: mouse clicks pin/unpin virtual fingers
  await frame.locator('#calculator-dialog').press('Escape');
  await frame.locator('[data-tab-btn="picker"]').click();
  await frame.locator('#picker-stage').click({ position: { x: 90, y: 120 } });
  await expect(frame.locator('#picker-stage .picker-circle')).toHaveCount(1);
  await frame.locator('#picker-stage').click({ position: { x: 240, y: 240 } });
  await expect(frame.locator('#picker-stage .picker-circle')).toHaveCount(2);
  // Clicking the first circle again lifts that pinned finger
  await frame.locator('#picker-stage').click({ position: { x: 90, y: 120 } });
  await expect(frame.locator('#picker-stage .picker-circle')).toHaveCount(1);

  // 1-click "5 fingers" button resets Picker and drops 5 staggered virtual fingers
  await page.locator('#btn-demo-picker').click();
  await expect(frame.locator('#picker-stage .picker-circle')).toHaveCount(5, { timeout: 3000 });

  // User's real saved counter in localStorage was never overwritten by the lab
  const savedCounters = await stored(page, 'counters-list');
  expect(savedCounters).toEqual([expect.objectContaining({ id: 'real', value: 99 })]);
});
