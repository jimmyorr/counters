import { test as base, expect } from '@playwright/test';

// Shared fixtures for all e2e tests:
// - Third-party requests (analytics, etc.) are aborted so tests are hermetic
//   and don't send real analytics hits. Tests can add their own page.route()
//   handlers, which take precedence over this one.
// - Uncaught page errors fail the test.
// - goto() and reload() wait for the app's startup banner, which init() logs
//   after all event handlers are bound. Otherwise a click right after load can
//   land before its handler exists. Applies to every page, including extra tabs.
const waitForStartupOnNavigate = (page) => {
  for (const method of ['goto', 'reload']) {
    const original = page[method].bind(page);
    page[method] = async (...args) => {
      const started = page.waitForEvent('console', {
        predicate: (msg) => msg.text().startsWith('🔢 Counters v'),
      });
      const response = await original(...args);
      await started;
      return response;
    };
  }
};

export const test = base.extend({
  context: async ({ context }, use) => {
    context.on('page', waitForStartupOnNavigate);
    await use(context);
  },
  page: async ({ page, baseURL }, use) => {
    const appOrigin = new URL(baseURL).origin;
    await page.route(
      (url) => url.origin !== appOrigin,
      (route) => route.abort(),
    );

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await use(page);

    expect(pageErrors, 'Uncaught page errors').toEqual([]);
  },
});

export { expect };
