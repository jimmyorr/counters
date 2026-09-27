import { test as base, expect } from '@playwright/test';

// Shared fixtures for all e2e tests:
// - Third-party requests (analytics, etc.) are aborted so tests are hermetic
//   and don't send real analytics hits. Tests can add their own page.route()
//   handlers, which take precedence over this one.
// - Uncaught page errors fail the test.
export const test = base.extend({
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
