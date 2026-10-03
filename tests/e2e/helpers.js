import { expect } from './fixtures.js';

// Capacitor Preferences stores keys in localStorage under this prefix on web
const PREFIX = 'CapacitorStorage.';

export const counter = (id, label, value = 0, extra = {}) => ({
  id,
  label,
  value,
  color: 0,
  increment: 1,
  resetValue: 0,
  ...extra,
});

// Seed saved state before the app boots. Only seeds once per test so that
// reloads see what the app saved rather than the original seed.
export const seed = (page, { counters, settings, history } = {}) =>
  page.addInitScript(
    ([prefix, data]) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      sessionStorage.setItem('e2e-seeded', '1');
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          localStorage.setItem(`${prefix}counters-${key}`, JSON.stringify(value));
        }
      }
    },
    [PREFIX, { list: counters, settings, history }],
  );

export const stored = async (page, key) =>
  JSON.parse(await page.evaluate((k) => localStorage.getItem(k), `${PREFIX}${key}`));

export const cards = (page) => page.locator('#counters-list-wrapper .counter-card');
export const card = (page, id) =>
  page.locator(`#counters-list-wrapper .counter-card[data-counter-id="${id}"]`);
export const valueOf = (cardLocator) => cardLocator.locator('.value-display');
export const labels = (page) => cards(page).locator('.counter-label');

export const openMainMenuItem = async (page, id) => {
  await page.locator('#btn-open-options').click();
  await page.locator(`#${id}`).click();
};

export const confirm = (page) => page.locator('#confirm-btn-ok').click();

export const undo = async (page) => {
  await expect(page.locator('#toast-action')).toBeVisible();
  await page.locator('#toast-action').click();
};

export const openCalculator = async (page, cardLocator) => {
  await cardLocator.locator('.card-value-body').click();
  await expect(page.locator('#calculator-dialog')).toBeVisible();
};

// Every palette in app.js. accessibility.spec.js fails if this list drifts.
export const PALETTES = ['bold', 'pastel', 'vintage', 'nautical', 'vaporwave', 'colorblind'];

// One counter per preset color slot
export const presets = () =>
  Array.from({ length: 8 }, (_, i) => counter(`p${i}`, `Preset ${i}`, 0, { color: i }));

// Contrast of an element's color (or border color) against what's painted
// behind it, folding in translucent layers and the element's opacity
export const contrast = (locator, prop = 'color') =>
  locator.evaluate((el, prop) => {
    const rgba = (css) => {
      const [r, g, b, a = 1] = css.match(/[\d.]+/g).map(Number);
      // color-mix() results compute as color(srgb r g b / a) with 0-1 channels
      const scale = css.startsWith('color(srgb') ? 255 : 1;
      return { rgb: [r * scale, g * scale, b * scale], a };
    };
    const over = (top, under) => under.map((c, i) => top.rgb[i] * top.a + c * (1 - top.a));
    const lum = ([r, g, b]) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    const layers = [];
    let opacity = 1;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      const bg = rgba(style.backgroundColor);
      if (bg.a > 0) layers.push(bg);
      if (bg.a === 1) break;
    }
    const page = document.documentElement.classList.contains('dark-mode') ? [13, 14, 17] : [255, 255, 255];
    const bg = layers.reverse().reduce((under, layer) => over(layer, under), page);
    const fg = rgba(getComputedStyle(el)[prop]);
    const ink = over({ rgb: fg.rgb, a: fg.a * opacity }, bg);
    const [a, b] = [lum(ink), lum(bg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, prop);
