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
