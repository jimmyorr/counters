import { test, expect } from './fixtures.js';
import { seed } from './helpers.js';

const T0 = new Date('2026-01-01T00:00:00');

const circles = (page) => page.locator('#picker-circles .picker-circle');
const winnerCircle = (page) => page.locator('#picker-circles .picker-circle.is-winner');
const promptEl = (page) => page.locator('#picker-prompt');
const promptTitle = (page) => page.locator('#picker-prompt-title');

const dispatchPointer = async (page, type, pointerId, offsetX = 100, offsetY = 100) => {
  await page.evaluate(
    ({ type, pointerId, offsetX, offsetY }) => {
      const stage = document.getElementById('picker-stage');
      const rect = stage.getBoundingClientRect();
      stage.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 1,
          clientX: rect.left + offsetX,
          clientY: rect.top + offsetY,
        }),
      );
    },
    { type, pointerId, offsetX, offsetY },
  );
};

test.describe('Picker tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: T0 });
    await page.goto('/');
    await page.locator('[data-tab-btn="picker"]').click();
    await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
    await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
  });

  test('opens the Picker tab with header title and idle prompt', async ({ page }) => {
    await expect(page.locator('#app-view-title')).toHaveText('Picker');
    await expect(page.locator('[data-tab-btn="picker"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-picker')).toHaveJSProperty('inert', false);
    await expect(promptEl(page)).not.toHaveClass(/hidden/);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');
    await expect(circles(page)).toHaveCount(0);
  });

  test('single finger shows one circle and does not select after 3+ seconds', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 120, 140);
    await expect(circles(page)).toHaveCount(1);
    await expect(promptTitle(page)).toHaveText('Waiting for another player');

    await page.clock.runFor(4500);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(0);

    await dispatchPointer(page, 'pointerup', 1, 120, 140);
    await expect(circles(page)).toHaveCount(0);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');
  });

  test('two or more fingers get unique colors and geometric shapes, then pick one winner after 3 seconds', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await dispatchPointer(page, 'pointerdown', 3, 140, 240);

    await expect(circles(page)).toHaveCount(3);
    await expect(promptEl(page)).toHaveClass(/hidden/);

    const colors = await circles(page).evaluateAll((els) => els.map((el) => el.dataset.color));
    const shapes = await circles(page).evaluateAll((els) => els.map((el) => el.dataset.shape));
    expect(new Set(colors).size).toBe(3);
    expect(new Set(shapes).size).toBe(3);
    await expect(page.locator('#picker-circles .picker-shape')).toHaveCount(3);

    // Just before 3s: all 3 shapes still present
    await page.clock.runFor(2900);
    await expect(circles(page)).toHaveCount(3);
    await expect(winnerCircle(page)).toHaveCount(0);

    // At 3s: staggered explosions start — 1st defeated pointer explodes immediately
    await page.clock.runFor(120);
    await expect(circles(page)).toHaveCount(2);
    await expect(page.locator('#picker-particles .picker-particle')).toHaveCount(14);
    await expect(winnerCircle(page)).toHaveCount(0);

    // 140ms later: 2nd defeated pointer explodes
    await page.clock.runFor(140);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(0);

    // 140ms after last explosion: winner reveal fires with background color flood
    await page.clock.runFor(160);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(1);
    await expect(page.locator('#picker-status')).toHaveText(/^\S+.* (triangle|square|diamond|pentagon|hexagon|star|octagon|cross|heart) selected$/);

    const winnerColor = await winnerCircle(page).getAttribute('data-color');
    const winnerBg = page.locator('#picker-winner-bg');
    await expect(winnerBg).toHaveClass(/active/);
    await expect(winnerBg).toHaveCSS('--winner-bg', winnerColor);
  });

  test('adding a finger mid-countdown resets the 3-second timer and rotation speed', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);

    await page.clock.runFor(2000);
    await expect(circles(page)).toHaveCount(2);

    const speedBeforeReset = Number(await page.locator('#picker-stage').getAttribute('data-rotation-speed'));
    expect(speedBeforeReset).toBeGreaterThan(300);

    // 3rd finger resets both the 3s countdown and rotation speed back to base (35 deg/s)
    await dispatchPointer(page, 'pointerdown', 3, 140, 240);
    await expect(circles(page)).toHaveCount(3);
    const speedAfterReset = Number(await page.locator('#picker-stage').getAttribute('data-rotation-speed'));
    expect(speedAfterReset).toBeLessThanOrEqual(40);

    // 2s after the 3rd finger (4s total) — still counting, and speed has accelerated again
    await page.clock.runFor(2000);
    await expect(circles(page)).toHaveCount(3);
    await expect(winnerCircle(page)).toHaveCount(0);
    const speedMidRamp = Number(await page.locator('#picker-stage').getAttribute('data-rotation-speed'));
    expect(speedMidRamp).toBeGreaterThan(300);

    // 1.4s later (past 3s + 2x140ms stagger) — winner selected
    await page.clock.runFor(1400);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(1);
  });

  test('lifting a finger resets countdown, and dropping below 2 cancels it', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await dispatchPointer(page, 'pointerdown', 3, 140, 240);

    await page.clock.runFor(2000);
    // Lift 3rd finger: 2 remain, timer resets to full 3s
    await dispatchPointer(page, 'pointerup', 3, 140, 240);
    await expect(circles(page)).toHaveCount(2);

    await page.clock.runFor(2000);
    await expect(circles(page)).toHaveCount(2);
    await expect(winnerCircle(page)).toHaveCount(0);

    // Lift 2nd finger: only 1 remains, countdown is cancelled
    await dispatchPointer(page, 'pointerup', 2, 200, 120);
    await expect(circles(page)).toHaveCount(1);
    await expect(promptTitle(page)).toHaveText('Waiting for another player');

    await page.clock.runFor(4000);
    await expect(circles(page)).toHaveCount(1);
    await expect(winnerCircle(page)).toHaveCount(0);
  });

  test('moving a finger drags its shape along on a short leash', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 100);
    const circle = circles(page).first();
    await expect(circle).toHaveCSS('--x', '80px');
    await expect(circle).toHaveCSS('--y', '100px');

    // Straight down 112px: the shape trails the finger by the 12px leash
    await dispatchPointer(page, 'pointermove', 1, 80, 212);
    await expect(circle).toHaveCSS('--x', '80px');
    await expect(circle).toHaveCSS('--y', '200px');
  });

  test('first shape stays put when a second finger lands and its touch point wobbles', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 140, 220);
    const first = circles(page).first();
    await expect(first).toHaveCSS('--x', '140px');
    await expect(first).toHaveCSS('--y', '220px');

    // Digitizers report the held finger a few px off when another finger lands
    await dispatchPointer(page, 'pointerdown', 2, 280, 480);
    await dispatchPointer(page, 'pointermove', 1, 144, 225);
    await dispatchPointer(page, 'pointermove', 1, 136, 214);
    await expect(circles(page)).toHaveCount(2);
    await expect(first).toHaveCSS('--x', '140px');
    await expect(first).toHaveCSS('--y', '220px');
  });

  test('winner stays highlighted until all fingers lift, then resets for a new round', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await page.clock.runFor(3300);

    await expect(winnerCircle(page)).toHaveCount(1);
    const winnerColor = await winnerCircle(page).getAttribute('data-color');
    await expect(page.locator('#picker-winner-bg')).toHaveClass(/active/);
    const winningId = Number(await winnerCircle(page).getAttribute('data-pointer-id'));
    const otherId = winningId === 1 ? 2 : 1;

    // Even if the winner lifts first, the highlight and background stay until all fingers lift
    await dispatchPointer(page, 'pointerup', winningId, 80, 120);
    await expect(winnerCircle(page)).toHaveCount(1);
    await expect(page.locator('#picker-winner-bg')).toHaveClass(/active/);

    // Lifting the remaining finger animates the background out (keeps --winner-bg for transition)
    await dispatchPointer(page, 'pointerup', otherId, 200, 120);
    await expect(circles(page)).toHaveCount(0);
    await expect(page.locator('#picker-winner-bg')).not.toHaveClass(/active/);
    await expect(page.locator('#picker-winner-bg')).toHaveCSS('--winner-bg', winnerColor);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');

    // Ready for a brand new round immediately
    await dispatchPointer(page, 'pointerdown', 10, 90, 150);
    await dispatchPointer(page, 'pointerdown', 11, 210, 150);
    await expect(circles(page)).toHaveCount(2);
    await page.clock.runFor(3300);
    await expect(winnerCircle(page)).toHaveCount(1);
  });

  test('switching away from the Picker tab resets active touches and countdown', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await expect(circles(page)).toHaveCount(2);

    await page.locator('[data-tab-btn="counters"]').click();
    await page.clock.runFor(3500);

    await page.locator('[data-tab-btn="picker"]').click();
    await expect(circles(page)).toHaveCount(0);
    await expect(winnerCircle(page)).toHaveCount(0);
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');
  });

  test('single-finger horizontal swipe flips back to the adjacent Timer tab', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 160);
    await expect(circles(page)).toHaveCount(1);

    await dispatchPointer(page, 'pointermove', 1, 170, 165);
    await expect(page.locator('[data-tab-btn="timer"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#app-view-title')).toHaveText('Timer');
    await expect(circles(page)).toHaveCount(0);
  });

  test('horizontal drag with two fingers stays on the Picker tab', async ({ page }) => {
    await dispatchPointer(page, 'pointerdown', 1, 80, 160);
    await dispatchPointer(page, 'pointerdown', 2, 200, 160);
    await expect(circles(page)).toHaveCount(2);

    await dispatchPointer(page, 'pointermove', 1, 190, 165);
    await expect(page.locator('[data-tab-btn="picker"]')).toHaveAttribute('aria-selected', 'true');
    await expect(circles(page)).toHaveCount(2);
  });

  test('triggers minor vibration on touch and major vibration on winner reveal', async ({ page }) => {
    await page.evaluate(() => {
      window.__vibrateCalls = [];
      navigator.vibrate = (pattern) => {
        window.__vibrateCalls.push(pattern);
        return true;
      };
    });

    await dispatchPointer(page, 'pointerdown', 1, 80, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    expect(await page.evaluate(() => window.__vibrateCalls)).toEqual([15, 15]);

    await page.clock.runFor(3300);
    await expect(winnerCircle(page)).toHaveCount(1);
    expect(await page.evaluate(() => window.__vibrateCalls)).toEqual([15, 15, [40, 30, 80]]);
  });
});

test('Picker respects hapticsEnabled: false', async ({ page }) => {
  await seed(page, { settings: { hapticsEnabled: false } });
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

  await page.evaluate(() => {
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });

  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);
  await page.clock.runFor(3300);
  await expect(winnerCircle(page)).toHaveCount(1);
  expect(await page.evaluate(() => window.__vibrateCalls)).toEqual([]);
});

test('Picker with reduced motion skips rotation and particle explosions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);
  await page.clock.runFor(1500);
  await expect(page.locator('#picker-stage')).not.toHaveAttribute('data-rotation-speed');

  await page.clock.runFor(1600);
  await expect(winnerCircle(page)).toHaveCount(1);
  await expect(page.locator('#picker-particles .picker-particle')).toHaveCount(0);
  await expect(page.locator('#picker-winner-bg')).toHaveClass(/active/);
});

test('Picker uses colors from the active app palette', async ({ page }) => {
  await seed(page, { settings: { palette: 'pastel' } });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });

  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);

  const pastelColors = new Set([
    '#93ddfa',
    '#fdc399',
    '#fdb2c8',
    '#c1d0fb',
    '#b6dfa0',
    '#e9cf87',
    '#86e6d3',
    '#d4b3fc',
  ]);
  const assigned = await circles(page).evaluateAll((els) => els.map((el) => el.dataset.color));
  expect(assigned).toHaveLength(2);
  for (const color of assigned) {
    expect(pastelColors.has(color)).toBe(true);
  }
});

test('all 9 Picker shapes stay centered on (50, 50) with stationary drop-shadows and strobe-safe max speed', async ({ page }) => {
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

  for (let i = 1; i <= 9; i++) {
    await dispatchPointer(page, 'pointerdown', i, 50 + (i % 3) * 90, 90 + Math.floor((i - 1) / 3) * 95);
  }
  await expect(circles(page)).toHaveCount(9);

  const metrics = await circles(page).evaluateAll((els) =>
    els.map((circle) => {
      const svg = circle.querySelector('.picker-shape');
      const geom = circle.querySelector('.picker-shape-path');
      const total = geom.getTotalLength();
      const samples = 120;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < samples; i++) {
        const pt = geom.getPointAtLength((total * i) / samples);
        sx += pt.x;
        sy += pt.y;
      }
      return {
        shape: circle.dataset.shape,
        cx: sx / samples,
        cy: sy / samples,
        svgFilter: getComputedStyle(svg).filter,
        circleFilter: getComputedStyle(circle).filter,
      };
    }),
  );

  expect(new Set(metrics.map((m) => m.shape)).size).toBe(9);
  for (const m of metrics) {
    expect(Math.hypot(m.cx - 50, m.cy - 50), `${m.shape} centroid drift`).toBeLessThan(0.5);
    expect(m.svgFilter, `${m.shape} rotating svg filter`).toBe('none');
    expect(m.circleFilter, `${m.shape} stationary wrapper filter`).not.toBe('none');
  }

  await page.clock.runFor(2950);
  const nearPeakSpeed = Number(await page.locator('#picker-stage').getAttribute('data-rotation-speed'));
  expect(nearPeakSpeed).toBeGreaterThan(450);
  expect(nearPeakSpeed).toBeLessThanOrEqual(520);
});

test.describe('Picker teams mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: T0 });
    await page.goto('/');
    await page.locator('[data-tab-btn="picker"]').click();
    await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
    await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
  });

  test('top-left mode pill is only active on Picker and toggles between Pick 1 and 2 teams', async ({ page }) => {
    const modeBtn = page.locator('#header-picker-mode');
    await expect(modeBtn).toHaveJSProperty('inert', false);
    await expect(page.locator('#header-picker-mode-text')).toHaveText('Pick 1');
    await expect(promptTitle(page)).toHaveText('Place fingers to choose');

    await modeBtn.click();
    await expect(page.locator('#header-picker-mode-text')).toHaveText('2 teams');
    await expect(page.locator('#picker-stage')).toHaveAttribute('data-mode', 'teams');
    await expect(page.locator('#picker-stage')).toHaveAttribute('data-team-count', '2');
    await expect(promptTitle(page)).toHaveText('Place fingers for 2 teams');

    // Switching away from Picker marks the mode pill inert
    await page.locator('[data-tab-btn="counters"]').click();
    await expect(modeBtn).toHaveJSProperty('inert', true);
  });

  test('splits 4 fingers into 2 even teams with shared color/shape and staggered shockwave reveal', async ({ page }) => {
    await page.evaluate(() => {
      window.__vibrateCalls = [];
      navigator.vibrate = (pattern) => {
        window.__vibrateCalls.push(pattern);
        return true;
      };
    });

    await page.locator('#header-picker-mode').click();
    await dispatchPointer(page, 'pointerdown', 1, 70, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await dispatchPointer(page, 'pointerdown', 3, 70, 260);
    await dispatchPointer(page, 'pointerdown', 4, 200, 260);

    await expect(page.locator('#header-picker-mode')).toHaveClass(/is-locked/);
    await expect(circles(page)).toHaveCount(4);

    // At 3000ms: Team 0 reveals first with shockwaves and sparkles
    await page.clock.runFor(3020);
    await expect(page.locator('#picker-circles .picker-circle.is-team-revealed')).toHaveCount(2);
    await expect(page.locator('#picker-particles .picker-shockwave')).toHaveCount(2);
    await expect(page.locator('#picker-particles .picker-particle')).toHaveCount(20);

    // 180ms later: Team 1 reveals and triggers major vibration without background flood
    await page.clock.runFor(200);
    await expect(page.locator('#picker-circles .picker-circle.is-team-revealed')).toHaveCount(4);
    await expect(page.locator('#picker-status')).toHaveText('2 teams selected');
    await expect(page.locator('#picker-winner-bg')).not.toHaveClass(/active/);

    const tokens = await circles(page).evaluateAll((els) =>
      els.map((el) => ({
        team: el.dataset.team,
        color: el.dataset.color,
        shape: el.dataset.shape,
      })),
    );
    const team0 = tokens.filter((t) => t.team === '0');
    const team1 = tokens.filter((t) => t.team === '1');
    expect(team0).toHaveLength(2);
    expect(team1).toHaveLength(2);
    expect(new Set(team0.map((t) => t.color)).size).toBe(1);
    expect(new Set(team0.map((t) => t.shape)).size).toBe(1);
    expect(new Set(team1.map((t) => t.color)).size).toBe(1);
    expect(new Set(team1.map((t) => t.shape)).size).toBe(1);
    expect(team0[0].color).not.toBe(team1[0].color);
    expect(team0[0].shape).not.toBe(team1[0].shape);

    // Major vibration fired at the end of the reveal
    const vibrates = await page.evaluate(() => window.__vibrateCalls);
    expect(vibrates[vibrates.length - 1]).toEqual([40, 30, 80]);

    // Lifting all fingers resets cleanly while keeping 2 teams mode active
    for (const id of [1, 2, 3, 4]) {
      await dispatchPointer(page, 'pointerup', id, 100, 100);
    }
    await expect(circles(page)).toHaveCount(0);
    await expect(page.locator('#header-picker-mode-text')).toHaveText('2 teams');
    await expect(page.locator('#header-picker-mode')).not.toHaveClass(/is-locked/);
    await expect(promptTitle(page)).toHaveText('Place fingers for 2 teams');
  });

  test('splits 3 fingers into balanced teams of 2 and 1', async ({ page }) => {
    await page.locator('#header-picker-mode').click();
    await dispatchPointer(page, 'pointerdown', 1, 70, 120);
    await dispatchPointer(page, 'pointerdown', 2, 200, 120);
    await dispatchPointer(page, 'pointerdown', 3, 135, 250);

    await page.clock.runFor(3300);
    await expect(page.locator('#picker-circles .picker-circle.is-team-revealed')).toHaveCount(3);

    const teams = await circles(page).evaluateAll((els) => els.map((el) => el.dataset.team));
    const counts = [
      teams.filter((t) => t === '0').length,
      teams.filter((t) => t === '1').length,
    ].sort((a, b) => a - b);
    expect(counts).toEqual([1, 2]);
  });
});

test('Picker teams mode with reduced motion reveals all teams immediately without effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

  await page.locator('#header-picker-mode').click();
  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);

  await page.clock.runFor(3050);
  await expect(page.locator('#picker-circles .picker-circle.is-team-revealed')).toHaveCount(2);
  await expect(page.locator('#picker-particles .picker-shockwave')).toHaveCount(0);
  await expect(page.locator('#picker-particles .picker-particle')).toHaveCount(0);
  await expect(page.locator('#picker-status')).toHaveText('2 teams selected');
});

test('Picker plays ascending harmonizing notes per finger, swells into reveal, and rotates chords on restart', async ({ page }) => {
  await page.addInitScript(() => {
    window.__oscCount = 0;
    window.__oscStopCount = 0;
    window.__swellTargets = [];
    const OrigCtx = window.AudioContext || window.webkitAudioContext;
    if (OrigCtx) {
      const origCreateOsc = OrigCtx.prototype.createOscillator;
      OrigCtx.prototype.createOscillator = function (...args) {
        window.__oscCount += 1;
        return origCreateOsc.apply(this, args);
      };
    }
    if (window.OscillatorNode?.prototype?.stop) {
      const origStop = window.OscillatorNode.prototype.stop;
      window.OscillatorNode.prototype.stop = function (...args) {
        window.__oscStopCount += 1;
        return origStop.apply(this, args);
      };
    }
    if (window.AudioParam?.prototype?.exponentialRampToValueAtTime) {
      const origRamp = window.AudioParam.prototype.exponentialRampToValueAtTime;
      window.AudioParam.prototype.exponentialRampToValueAtTime = function (value, endTime) {
        if (value > 1.5) window.__swellTargets.push({ value, endTime });
        return origRamp.call(this, value, endTime);
      };
    }
  });
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

  await page.evaluate(() => {
    window.__oscCount = 0;
    window.__oscStopCount = 0;
    window.__swellTargets = [];
  });
  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);
  await dispatchPointer(page, 'pointerdown', 3, 140, 240);

  const chord1 = await page.locator('#picker-stage').getAttribute('data-chord');
  expect(chord1).toBeTruthy();

  const notes1 = await circles(page).evaluateAll((els) => els.map((el) => Number(el.dataset.note)));
  expect(notes1).toHaveLength(3);
  expect(notes1[0]).toBeLessThan(notes1[1]);
  expect(notes1[1]).toBeLessThan(notes1[2]);

  // 3 fingers x 2 oscillators per sustained voice (fundamental + overtone) = 6, none stopped while held
  const touchAudio = await page.evaluate(() => ({
    oscCount: window.__oscCount,
    oscStopCount: window.__oscStopCount,
    swellCount: window.__swellTargets.length,
  }));
  expect(touchAudio.oscCount).toBe(6);
  expect(touchAudio.oscStopCount).toBe(0);
  expect(touchAudio.swellCount).toBeGreaterThanOrEqual(1);

  // Lifting a finger stops its 2 oscillators cleanly
  await dispatchPointer(page, 'pointerup', 3, 140, 240);
  expect(await page.evaluate(() => window.__oscStopCount)).toBe(2);

  // Re-add finger 3 so all 3 are in the round (+2 oscillators = 8 total)
  await dispatchPointer(page, 'pointerdown', 4, 140, 240);
  expect(await page.evaluate(() => window.__oscCount)).toBe(8);

  // Run through 3s countdown + 2 staggered explosions + winner resolution arpeggio
  await page.clock.runFor(3400);
  await expect(winnerCircle(page)).toHaveCount(1);
  // 8 (touches) + 2 (explosion pops) + 8 (4-note chord resolution x 2 oscs) = 18; all 18 oscillators stopped
  const revealAudio = await page.evaluate(() => ({
    oscCount: window.__oscCount,
    oscStopCount: window.__oscStopCount,
  }));
  expect(revealAudio.oscCount).toBe(18);
  expect(revealAudio.oscStopCount).toBe(18);

  // Lift all fingers to end the round, then start a new round -> must pick a different chord
  for (const id of [1, 2, 4]) {
    await dispatchPointer(page, 'pointerup', id, 100, 100);
  }
  await expect(page.locator('#picker-stage')).not.toHaveAttribute('data-chord');

  await dispatchPointer(page, 'pointerdown', 10, 90, 150);
  const chord2 = await page.locator('#picker-stage').getAttribute('data-chord');
  expect(chord2).toBeTruthy();
  expect(chord2).not.toBe(chord1);
});

test('Picker harmonic audio respects soundEnabled: false', async ({ page }) => {
  await seed(page, { settings: { soundEnabled: false } });
  await page.addInitScript(() => {
    window.__oscCount = 0;
    const OrigCtx = window.AudioContext || window.webkitAudioContext;
    if (OrigCtx) {
      const origCreateOsc = OrigCtx.prototype.createOscillator;
      OrigCtx.prototype.createOscillator = function (...args) {
        window.__oscCount += 1;
        return origCreateOsc.apply(this, args);
      };
    }
  });
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));

  await page.evaluate(() => { window.__oscCount = 0; });
  await dispatchPointer(page, 'pointerdown', 1, 80, 120);
  await dispatchPointer(page, 'pointerdown', 2, 200, 120);
  await page.clock.runFor(3300);
  await expect(winnerCircle(page)).toHaveCount(1);
  expect(await page.evaluate(() => window.__oscCount)).toBe(0);
});

test('Picker selects a distinct instrument per palette and previews it in Settings', async ({ page }) => {
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
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });

  const expected = [
    ['pastel', 'celesta', 'sine'],
    ['vintage', 'rhodes', 'sine'],
    ['nautical', 'brass', 'sawtooth'],
    ['vaporwave', 'synth', 'sawtooth'],
    ['colorblind', 'vibraphone', 'sine'],
    ['bold', 'marimba', 'sine'],
  ];

  for (const [paletteKey, instrumentId, primaryWave] of expected) {
    // Open Settings and select the palette -> should play 3-note triad preview (6 oscillators)
    await page.locator('#btn-open-options').click();
    await page.locator('#menu-btn-open-settings').click();
    await expect(page.locator('#settings-dialog')).toBeVisible();
    await page.evaluate(() => { window.__oscTypes = []; });
    await page.locator(`#setting-palette-group [data-palette-opt="${paletteKey}"]`).click();
    const previewTypes = await page.evaluate(() => window.__oscTypes);
    expect(previewTypes).toHaveLength(6);
    expect(previewTypes).toContain(primaryWave);

    // Close Settings and verify data-instrument + live voice wave on Picker
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-dialog')).toBeHidden();

    await page.evaluate(() => { window.__oscTypes = []; });
    await dispatchPointer(page, 'pointerdown', 1, 120, 180);
    await expect(page.locator('#picker-stage')).toHaveAttribute('data-instrument', instrumentId);
    const liveTypes = await page.evaluate(() => window.__oscTypes);
    expect(liveTypes).toHaveLength(2);
    expect(liveTypes[0]).toBe(primaryWave);

    await dispatchPointer(page, 'pointerup', 1, 120, 180);
    await expect(page.locator('#picker-stage')).not.toHaveAttribute('data-instrument');
  }
});

test('Picker uses major chords in light mode and minor chords in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.locator('[data-tab-btn="picker"]').click();
  await expect(page.locator('#picker-stage')).toBeInViewport({ ratio: 0.99 });

  // Light mode -> bright major triad (interval between root and 3rd = 4 semitones)
  await dispatchPointer(page, 'pointerdown', 1, 80, 140);
  await dispatchPointer(page, 'pointerdown', 2, 200, 140);
  const lightChord = await page.locator('#picker-stage').getAttribute('data-chord');
  expect(lightChord).toMatch(/^[A-G]b?$/);
  const lightNotes = await circles(page).evaluateAll((els) => els.map((el) => Number(el.dataset.note)));
  expect(lightNotes[1] - lightNotes[0]).toBe(4);

  await dispatchPointer(page, 'pointerup', 1, 80, 140);
  await dispatchPointer(page, 'pointerup', 2, 200, 140);
  await expect(page.locator('#picker-stage')).not.toHaveAttribute('data-chord');

  // Switch device to dark mode -> deeper minor triad (interval = 3 semitones, lower root)
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await dispatchPointer(page, 'pointerdown', 3, 80, 140);
  await dispatchPointer(page, 'pointerdown', 4, 200, 140);
  const darkChord = await page.locator('#picker-stage').getAttribute('data-chord');
  expect(darkChord).toMatch(/^[A-G]#?m$/);
  const darkNotes = await circles(page).evaluateAll((els) => els.map((el) => Number(el.dataset.note)));
  expect(darkNotes[1] - darkNotes[0]).toBe(3);
  expect(darkNotes[0]).toBeLessThan(lightNotes[0]);
});

