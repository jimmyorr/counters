import { test, expect } from './fixtures.js';
import { seed, stored, counter, card, labels } from './helpers.js';

const three = () => [counter('a', 'Alpha'), counter('b', 'Bravo'), counter('c', 'Charlie')];

// Press and hold a card's header (on the label, away from the header buttons)
const holdHeader = async (page, id, ms) => {
  const box = await card(page, id).locator('.counter-label').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  return { x, y };
};

test('holding a card header and dragging reorders cards', async ({ page }) => {
  await seed(page, { counters: three() });
  await page.goto('/');

  const start = await holdHeader(page, 'a', 500); // past the 350ms hold threshold
  await expect(page.locator('.drag-ghost')).toHaveCount(1);
  const target = await card(page, 'c').boundingBox();
  await page.mouse.move(start.x, target.y + target.height - 5, { steps: 12 });
  await page.mouse.up();

  await expect(labels(page)).toHaveText(['Bravo', 'Charlie', 'Alpha']);
  await expect(page.locator('.drag-ghost, .drag-placeholder')).toHaveCount(0);
  expect((await stored(page, 'counters-list')).map((c) => c.id)).toEqual(['b', 'c', 'a']);
});

test('moving before the hold threshold does not start a drag', async ({ page }) => {
  await seed(page, { counters: three() });
  await page.goto('/');

  const start = await holdHeader(page, 'a', 50);
  await page.mouse.move(start.x + 60, start.y, { steps: 5 }); // swipe-like movement
  await page.waitForTimeout(500);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(labels(page)).toHaveText(['Alpha', 'Bravo', 'Charlie']);
});

test('holding a header with auto-sort on explains why dragging is off', async ({ page }) => {
  await seed(page, { counters: three(), settings: { autoSort: true } });
  await page.goto('/');

  await holdHeader(page, 'a', 700);
  await page.mouse.up();
  await expect(page.locator('#toast-text')).toHaveText('🚫 Auto-sorting enabled');
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('a long press with auto-sort on does not also open the editor', async ({ page }) => {
  await seed(page, { counters: three(), settings: { autoSort: true } });
  await page.goto('/');

  // Hold well past the warning before releasing
  await holdHeader(page, 'a', 1500);
  await page.mouse.up();
  await expect(page.locator('#toast-text')).toHaveText('🚫 Auto-sorting enabled');
  await page.waitForTimeout(300);
  await expect(page.locator('#edit-counter-dialog')).toBeHidden();

  // The next ordinary tap on the header still opens the editor
  await card(page, 'a').locator('.card-header').click();
  await expect(page.locator('#edit-counter-dialog')).toBeVisible();
});
