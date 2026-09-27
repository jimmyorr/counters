import { test, expect } from './fixtures.js';

// Simulates a "black-hole" network (e.g. a subway): the device reports
// online, but requests to other hosts never get a response or an error.
// Render-blocking third-party resources would leave the app blank forever.
test('starts up when third-party requests never respond', async ({
  page,
  baseURL,
}) => {
  const appOrigin = new URL(baseURL).origin;
  const blackholed = [];
  await page.route(
    (url) => url.origin !== appOrigin,
    (route) => {
      // Never fulfill, continue, or abort
      blackholed.push(route.request().url());
    },
  );

  // Don't wait for the load event; a stalled request can delay it forever
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page).toHaveTitle('Counters', { timeout: 5000 });

  // A screenshot requires a painted frame
  await page.screenshot({ timeout: 5000 });

  await expect(page.locator('#empty-state-view')).toBeVisible({
    timeout: 8000,
  });

  const loadedFonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family.replace(/"/g, ''));
  });
  expect(loadedFonts).toEqual(
    expect.arrayContaining(['Outfit Variable', 'Inter Variable']),
  );

  test.info().annotations.push({
    type: 'blackholed',
    description: blackholed.join(', ') || 'none',
  });
});
