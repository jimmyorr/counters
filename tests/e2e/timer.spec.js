import { test, expect } from './fixtures.js';

const T0 = new Date('2026-01-01T00:00:00');

const display = (page) => page.locator('#placeholder-stopwatch-display');
const start = (page) => page.locator('#btn-timer-placeholder-start');
const reset = (page) => page.locator('#btn-timer-placeholder-reset');
const add = (page, secs) => page.locator(`.timer-inc-btn[data-secs="${secs}"]`);

// The display updates on a 30ms interval, so allow one tick of slack
const expectTime = async (page, expectedMs) => {
  const shownMs = async () => {
    const [m, s] = (await display(page).textContent()).split(':');
    return Math.round((Number(m) * 60 + Number(s)) * 1000);
  };
  await expect.poll(async () => Math.abs((await shownMs()) - expectedMs)).toBeLessThanOrEqual(100);
};

// Toggle start/pause and confirm the click registered before moving on
const press = async (page, expectedLabel) => {
  await start(page).click();
  await expect(start(page)).toHaveText(expectedLabel);
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="timer"]').click();
  // Freeze time so readings are exact regardless of how long actions take
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
});

test('stopwatch counts up, pauses, and resumes', async ({ page }) => {
  await expect(reset(page)).toBeDisabled();
  await press(page, 'Pause');
  await page.clock.runFor(3000);
  await expectTime(page, 3000);

  await press(page, 'Start'); // pause
  await page.clock.runFor(5000);
  await expectTime(page, 3000);

  await press(page, 'Pause'); // resume
  await page.clock.runFor(2000);
  await expectTime(page, 5000);
});

test('adding time while the stopwatch runs keeps the elapsed time', async ({ page }) => {
  await press(page, 'Pause');
  await page.clock.runFor(5000);
  await add(page, 10).click();
  await page.clock.runFor(100);
  // 5s elapsed + 10s added, now counting down
  await expectTime(page, 14900);
});

test('countdown finishes at zero and returns to stopwatch mode', async ({ page }) => {
  await add(page, 10).click();
  await expectTime(page, 10000);

  await press(page, 'Pause');
  await page.clock.runFor(4000);
  await expectTime(page, 6000);

  await page.clock.runFor(7000);
  await expect(display(page)).toHaveText('00:00.0');
  await expect(start(page)).toHaveText('Start');
  await expect(reset(page)).toBeDisabled();

  // Starting again counts up from zero
  await press(page, 'Pause');
  await page.clock.runFor(2000);
  await expectTime(page, 2000);
});

test('reset stops and clears the timer', async ({ page }) => {
  await add(page, 60).click();
  await press(page, 'Pause');
  await page.clock.runFor(1500);
  await reset(page).click();

  await expect(display(page)).toHaveText('00:00.0');
  await expect(start(page)).toHaveText('Start');
  await page.clock.runFor(2000);
  await expect(display(page)).toHaveText('00:00.0');
});
