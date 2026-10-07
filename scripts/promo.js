// Promotional screenshots, artwork and video from the shot list in
// scripts/promo-shots.js. Each shot is saved app state plus a few taps, so the
// assets can be re-rendered after visual changes.
//
// Usage:
//   node scripts/promo.js sheet [shot ...]           small renders and a
//                                                    contact sheet, for review
//   node scripts/promo.js stills [shot ...]          each shot for each still
//                                                    target (STILLS=iphone,web)
//   node scripts/promo.js video <target> [shot ...]  the clips, then the edited
//                                                    video (e.g. iphone-preview)
//   node scripts/promo.js artwork [name ...]         single images: the YouTube
//                                                    thumbnail, App Store header
//                                                    and search results asset,
//                                                    and Google Play's feature
//                                                    graphic (ARTWORK)
//   node scripts/promo.js open <shot>                a Chrome window with the
//                                                    shot set up, to adjust it
//   node scripts/promo.js view                       rewrites promo/index.html,
//                                                    a page for browsing the
//                                                    stills (stills does too),
//                                                    and opens it
//
// Each mode is also an npm script: npm run promo:stills [-- shot ...]
//
// Targets (sizes, device, cards) are in promo-shots.js. By default it renders
// a production build written to a temp dir (never docs/); APP_URL (e.g.
// http://localhost:5173/) uses the dev server instead. Output goes to promo/
// (OUT=dir). Options (env): SHEET (the target for the contact sheet, shrunk;
// default iphone), FPS (30), MUSIC (an audio file for the video; default
// silence), MUSIC_START (seconds into the track to start it, e.g. to skip a
// quiet intro; default 0). Needs ffmpeg and Chrome.
//
// Every shot runs on a virtual clock: Playwright's clock drives the app's
// timers and animation frames, and the page's CSS animations and transitions
// are paused and stepped with it, so a still or a clip comes out the same on
// every run however slowly the frames render. Clips advance exactly 1/FPS of
// a second per frame.
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');
const { ARTWORK, BASE_SETTINGS, LOGO, SHOTS, TARGETS } = require('./promo-shots.js');

const ROOT = path.join(__dirname, '..');
const USAGE =
  'Usage: node scripts/promo.js sheet|stills|view [shot ...]\n' +
  '       node scripts/promo.js artwork [name ...]\n' +
  '       node scripts/promo.js video <target> [shot ...]\n' +
  '       node scripts/promo.js open <shot>';
const [mode, ...args] = process.argv.slice(2);
if (!['sheet', 'stills', 'artwork', 'video', 'open', 'view'].includes(mode)) {
  console.error(USAGE);
  process.exit(1);
}
const videoTargetName = mode === 'video' ? args.shift() : null;
const videoTarget = videoTargetName && TARGETS[videoTargetName];
if (mode === 'video' && !videoTarget?.video) {
  const videoTargets = Object.keys(TARGETS).filter((t) => TARGETS[t].video);
  console.error(`${USAGE}\nVideo targets: ${videoTargets.join(', ')}`);
  process.exit(1);
}
if (mode === 'open' && args.length !== 1) {
  console.error(USAGE);
  process.exit(1);
}
const OUT = path.resolve(process.env.OUT || path.join(ROOT, 'promo'));
const FPS = Number(process.env.FPS || 30);
const MUSIC = process.env.MUSIC || 'none';
const MUSIC_START = Number(process.env.MUSIC_START || 0);
// The app's clock starts here in every shot (local time)
const T0 = new Date('2026-01-01T20:42:00').getTime();
let failed = false;

// Shots, or for artwork the ARTWORK names
const choices = mode === 'artwork' ? ARTWORK : SHOTS;
const selected = args.length ? args : Object.keys(choices);
for (const name of selected) {
  if (!choices[name]) {
    console.error(`Unknown name "${name}". Choices: ${Object.keys(choices)}`);
    process.exit(1);
  }
}

// The app as a phone screen on a stage, at this CSS size
const SCREEN = { width: 402, height: 874 };

fs.mkdirSync(OUT, { recursive: true });

// A page for browsing the stills in OUT, by device or by shot
function writeViewer() {
  const devices = Object.keys(TARGETS).filter((t) => !TARGETS[t].video);
  const stills = [];
  for (const shot of Object.keys(SHOTS)) {
    for (const device of devices) {
      const file = `${shot}-${device}.jpg`;
      if (fs.existsSync(path.join(OUT, file))) stills.push({ shot, device, file });
    }
  }
  const sizes = Object.fromEntries(
    devices.map((d) => {
      const t = TARGETS[d];
      const scale = t.scale || 1;
      return [d, `${Math.round(t.width * scale)}x${Math.round(t.height * scale)}`];
    }),
  );
  const data = JSON.stringify({ stills, devices, sizes });
  const file = path.join(OUT, 'index.html');
  fs.writeFileSync(
    file,
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Counters promo stills</title>
<style>
  :root { color-scheme: dark; --bg: #0d0e11; --panel: #1a1c22; --text: #e8e9ee;
    --muted: #8b8f9c; --accent: #3aa8f8; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.4 -apple-system, system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 1; background: var(--panel);
    padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 8px 16px;
    align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  h1 { margin: 0; font-size: 16px; font-weight: 600; }
  .group { display: flex; flex-wrap: wrap; gap: 6px; }
  button { font: inherit; color: var(--text); background: #262933;
    border: 1px solid #353946; border-radius: 999px; padding: 4px 12px;
    cursor: pointer; }
  button[aria-pressed="true"] { background: var(--accent); color: #0d0e11;
    border-color: var(--accent); }
  .divider { width: 1px; align-self: stretch; background: #353946; }
  main { padding: 16px; display: flex; flex-wrap: wrap; gap: 16px;
    align-items: flex-start; }
  figure { margin: 0; }
  figure a { display: block; }
  figure img { display: block; width: auto; height: auto; max-height: var(--h);
    max-width: calc(100vw - 32px); border-radius: 6px; background: #000; }
  figcaption { color: var(--muted); padding-top: 4px; }
  .empty { color: var(--muted); }
</style></head>
<body>
<header>
  <h1>Promo stills</h1>
  <div class="group" id="modes"></div>
  <div class="divider"></div>
  <div class="group" id="picks"></div>
</header>
<main id="grid"></main>
<script>
const {stills, devices, sizes} = ${data};
const shots = [...new Set(stills.map((s) => s.shot))];
const state = {mode: 'device', pick: devices[0]};
try {
  const [mode, pick] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (mode === 'device' || mode === 'shot') Object.assign(state, {mode, pick});
} catch {}
function button(label, pressed, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.setAttribute('aria-pressed', pressed);
  b.onclick = onClick;
  return b;
}
function render() {
  const options = state.mode === 'device' ? devices : shots;
  if (!options.includes(state.pick)) state.pick = options[0];
  history.replaceState(null, '', '#' + state.mode + '/' + state.pick);
  document.getElementById('modes').replaceChildren(
    button('By device', state.mode === 'device', () => { state.mode = 'device'; render(); }),
    button('By shot', state.mode === 'shot', () => { state.mode = 'shot'; render(); })
  );
  document.getElementById('picks').replaceChildren(
    ...options.map((o) => button(o, o === state.pick, () => { state.pick = o; render(); }))
  );
  const grid = document.getElementById('grid');
  const shown = stills.filter((s) => s[state.mode] === state.pick);
  // Portrait devices get taller tiles; in one shot's row every device gets the same height
  const height = (d) => state.mode === 'shot' ? '360px'
    : ['iphone', 'iphone-medium', 'ipad'].includes(d) ? '520px' : '300px';
  grid.replaceChildren(...shown.map((s) => {
    const fig = document.createElement('figure');
    fig.style.setProperty('--h', height(s.device));
    const a = document.createElement('a');
    a.href = s.file;
    a.target = '_blank';
    const img = document.createElement('img');
    img.src = s.file;
    img.alt = s.shot + ' on ' + s.device;
    img.loading = 'lazy';
    a.append(img);
    const cap = document.createElement('figcaption');
    cap.textContent = (state.mode === 'device' ? s.shot : s.device) + ' · ' + sizes[s.device];
    fig.append(a, cap);
    return fig;
  }));
  if (!shown.length) {
    grid.innerHTML = '<p class="empty">No stills yet. Run npm run promo:stills.</p>';
  }
}
render();
</script>
</body></html>
`,
  );
  return file;
}

if (mode === 'view') {
  const page = writeViewer();
  console.log(page);
  if (process.platform === 'darwin') execFileSync('open', [page]);
  process.exit(0);
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// A static server for a build, on a free port
function serveDir(dir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, urlPath);
    if (!file.startsWith(dir)) file = dir;
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// Fonts and the icon as data URLs, for the cards and the stage
const dataUrl = (file, type) =>
  `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString('base64')}`;
const FONTS = `
  @font-face { font-family: Outfit; font-weight: 100 900; src: url(${dataUrl(
    'node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2',
    'font/woff2',
  )}); }
  @font-face { font-family: Inter; font-weight: 100 900; src: url(${dataUrl(
    'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    'font/woff2',
  )}); }`;
const ICON = dataUrl('public/icon-512.png', 'image/png');

// The background behind the stage's screens and the cards: the graphite and
// soft light of the app's feature graphic
const BACKDROP = `
  background:
    radial-gradient(60% 80% at 50% 45%, rgba(58, 168, 248, 0.16), transparent 70%),
    radial-gradient(90% 120% at 100% 0%, rgba(120, 130, 150, 0.22), transparent 60%),
    linear-gradient(160deg, #23262d 0%, #121317 55%, #0b0c0f 100%);`;

// The icon and name, with an optional tagline and smaller lines, sized in
// units of the frame's shorter side (u)
const lockupCss = (u) => `
  .lockup { display: flex; flex-direction: column; align-items: center;
    text-align: center; color: #fff; font-family: Outfit, sans-serif; }
  .lockup img { width: calc(${u} * 30); height: calc(${u} * 30); border-radius: 22.5%;
    box-shadow: 0 calc(${u} * 2) calc(${u} * 6) rgba(0, 0, 0, 0.5); }
  .lockup h1 { margin: calc(${u} * 6) -0.3em 0 0; font-weight: 500;
    font-size: calc(${u} * 6.4); letter-spacing: 0.3em; }
  .lockup p { margin: calc(${u} * 2.5) 0 0; font: 300 calc(${u} * 4.4) Inter, sans-serif;
    letter-spacing: 0.02em; color: rgba(255, 255, 255, 0.8); }
  .lockup p.small { margin-top: calc(${u} * 3); font-weight: 500;
    font-size: calc(${u} * 3.2); letter-spacing: 0.12em; color: rgba(255, 255, 255, 0.6); }`;
const lockupHtml = ({ title, tagline, lines = [] }) =>
  `<div class="lockup"><img src="${ICON}" alt=""><h1>${title}</h1>${
    tagline ? `<p>${tagline}</p>` : ''
  }${lines.map((line) => `<p class="small">${line}</p>`).join('')}</div>`;

// A stage: phone screens side by side over the backdrop, with the icon and
// name on the left when `logo` is set. Screens are filled in with setScreens.
function stageHtml(target, count) {
  const { width: W, height: H } = target;
  const logoW = target.logo ? W * 0.38 : 0;
  const gap = W * 0.025;
  const room = W - logoW - W * 0.08;
  const screenH = Math.min(H * 0.84, (room - gap * (count - 1)) / count / (SCREEN.width / SCREEN.height));
  const screenW = screenH * (SCREEN.width / SCREEN.height);
  const u = `${Math.min(W, H) / 100}px`;
  return {
    screenW,
    screenH,
    html: `<!doctype html><meta charset="utf-8"><style>${FONTS}${lockupCss(u)}
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
      body { display: flex; align-items: center; justify-content: center; ${BACKDROP} }
      .logo { width: ${logoW}px; display: flex; justify-content: center; }
      .logo .lockup img { width: calc(${u} * 22); height: calc(${u} * 22); }
      .screens { display: flex; gap: ${gap}px; margin: 0 ${W * 0.04}px; }
      .screens img { width: ${screenW}px; height: ${screenH}px; display: block;
        border-radius: ${screenW * 0.11}px; background: #000;
        box-shadow: 0 0 0 ${Math.max(1, screenW * 0.004)}px rgba(255, 255, 255, 0.14),
          0 ${screenH * 0.03}px ${screenH * 0.08}px rgba(0, 0, 0, 0.55); }
    </style>${target.logo ? `<div class="logo">${lockupHtml(LOGO)}</div>` : ''}<div class="screens">${'<img alt="">'.repeat(count)}</div>`,
  };
}

// Opens a stage page: call setScreens with each screen's JPEG, then screenshot
async function openStage(browser, target, count) {
  const { html, screenW, screenH } = stageHtml(target, count);
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: target.scale || 1,
  });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  page.setScreens = (buffers) =>
    page.evaluate(
      (srcs) =>
        Promise.all(
          [...document.querySelectorAll('.screens img')].map((img, i) => {
            img.src = srcs[i];
            return img.decode();
          }),
        ),
      buffers.map((b) => `data:image/jpeg;base64,${b.toString('base64')}`),
    );
  // The size to render each screen at: the stage's CSS size for one screen,
  // at enough density to stay sharp
  page.screenTarget = {
    ...SCREEN,
    scale: (screenH * (target.scale || 1)) / SCREEN.height,
    mobile: true,
  };
  page.screenW = screenW;
  return page;
}

// The app: a build in a temp dir (set up in main), or APP_URL
let base = process.env.APP_URL;

// Installed before the app loads, in every page: seeded random numbers, and
// stepping for CSS animations and transitions. Each step pauses any new
// animation and moves every animation on by dt, finishing those that reach
// their end, so they keep time with the virtual clock.
function installPromoHooks({ seed, hideCaret }) {
  const mulberry = (a) => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = mulberry(seed);

  // No text cursor in renders. Hidden here for good rather than by each
  // screenshot (Playwright's default), whose restyle just before the capture
  // can catch a focused field's sheet half redrawn, as a blank patch
  if (hideCaret) {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '* { caret-color: transparent !important; }';
      document.head.append(style);
    });
  }

  // Smooth scrolls (switching tabs) run in real time in the browser, so they
  // play out on animation frames instead, which follow the virtual clock.
  // Scroll snapping is off while they run, or every step would snap back.
  const nativeScrollTo = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (options, y) {
    if (typeof options !== 'object' || options.behavior !== 'smooth') {
      return nativeScrollTo.call(this, options, y);
    }
    const el = this;
    const from = { left: el.scrollLeft, top: el.scrollTop };
    const to = { left: options.left ?? from.left, top: options.top ?? from.top };
    const token = (el.__promoScroll = {});
    let start = null;
    el.style.scrollSnapType = 'none';
    const tick = (now) => {
      if (el.__promoScroll !== token) return;
      start ??= now;
      const p = Math.min(1, (now - start) / 350);
      const eased = 1 - (1 - p) ** 3;
      nativeScrollTo.call(el, {
        left: from.left + (to.left - from.left) * eased,
        top: from.top + (to.top - from.top) * eased,
        behavior: 'instant',
      });
      if (p < 1) requestAnimationFrame(tick);
      else el.style.scrollSnapType = '';
    };
    requestAnimationFrame(tick);
  };

  let started = false;
  window.__promo = {
    reseed: (s) => {
      Math.random = mulberry(s);
    },
    step(dt) {
      for (const anim of document.getAnimations()) {
        if (anim.__promoDone || anim.playState === 'idle') continue;
        if (anim.__promoTime === undefined) {
          // Animations running when stepping starts keep their progress
          anim.__promoTime = started ? 0 : anim.currentTime || 0;
          anim.pause();
        }
        anim.__promoTime += dt;
        const end = anim.effect ? anim.effect.getComputedTiming().endTime : 0;
        if (Number.isFinite(end) && anim.__promoTime >= end) {
          anim.__promoDone = true;
          anim.finish();
        } else {
          anim.currentTime = anim.__promoTime;
        }
      }
      started = true;
    },
  };
}

// The app helper the shots' setup and clip get (see promo-shots.js). `onFrame`
// runs after each frame while filming.
function appHelper(page, { live = false } = {}) {
  const app = {
    onFrame: null,
    async wait(ms) {
      if (live) return page.waitForTimeout(ms);
      const frames = Math.max(1, Math.round((ms * FPS) / 1000));
      for (let i = 0; i < frames; i++) {
        await page.clock.runFor(1000 / FPS);
        await page.evaluate((dt) => window.__promo.step(dt), 1000 / FPS);
        if (app.onFrame) await app.onFrame();
      }
    },
    async tap(selector) {
      const box = await page.locator(selector).first().boundingBox();
      if (!box) throw new Error(`Nothing to tap at ${selector}`);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      // In videos, a soft dot shows where the tap lands
      if (app.onFrame) {
        await page.evaluate(
          ([x, y]) => {
            const dot = document.createElement('div');
            dot.style.cssText =
              `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;` +
              'border-radius:50%;background:rgba(255,255,255,0.55);z-index:2147483647;' +
              'box-shadow:0 0 0 2px rgba(0,0,0,0.25);pointer-events:none';
            document.body.append(dot);
            dot
              .animate(
                [
                  { transform: 'scale(0.6)', opacity: 1 },
                  { transform: 'scale(1.3)', opacity: 0 },
                ],
                { duration: 450, easing: 'ease-out' },
              )
              .finished.then(() => dot.remove());
          },
          [x, y],
        );
      }
      await page.mouse.click(x, y);
    },
    async type(selector, text) {
      await page.locator(selector).first().focus();
      for (const ch of text) {
        await page.keyboard.type(ch);
        await app.wait(120);
      }
    },
    random(seed) {
      return page.evaluate((s) => window.__promo.reseed(s), seed);
    },
  };
  return app;
}

// Opens a shot in a fresh context (its own saved state), at a target's size
// and density, emulating a phone or tablet, and runs its setup (`forClip`:
// the clip's). `live` skips the virtual clock, for the open mode.
async function openShot(browser, name, target, { live = false, forClip = false } = {}) {
  const shot = SHOTS[name];
  const context = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: target.scale || 1,
    isMobile: !!target.mobile,
    hasTouch: !!target.mobile,
  });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // Keep renders out of analytics: only the app's own requests go through
  const origin = new URL(base).origin;
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  await page.addInitScript(
    ([prefix, data]) => {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(`${prefix}counters-${key}`, JSON.stringify(value));
      }
    },
    [
      'CapacitorStorage.',
      {
        list: shot.counters || [],
        settings: { ...BASE_SETTINGS, ...shot.settings, ...target.settings },
        history: shot.history || [],
      },
    ],
  );
  await page.addInitScript(installPromoHooks, { seed: 1, hideCaret: !live });
  if (!live) await page.clock.install({ time: T0 });
  // The startup banner prints once every handler is bound
  const started = page.waitForEvent('console', {
    predicate: (msg) => msg.text().startsWith('🔢 Counters v'),
    timeout: 30000,
  });
  await page.goto(base);
  await started;
  await page.evaluate(() => document.fonts.ready);
  if (!live) await page.clock.pauseAt(T0 + 1000);
  const app = appHelper(page, { live });
  await app.wait(600);
  // A clip can start from its own setup (clipSetup, even an empty one)
  const setup = forClip && 'clipSetup' in shot ? shot.clipSetup : shot.setup;
  if (setup) await setup(app);
  await app.wait(300);
  page.app = app;
  page.close = () => context.close();
  return page;
}

function reportErrors(name, page) {
  if (page.errors.length) {
    console.error(`  ${name} errors:\n  ${page.errors.join('\n  ')}`);
    failed = true;
  }
}

function ffmpeg(ffArgs) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ffArgs], { stdio: 'inherit' });
}

const H264 = ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p'];

// Renders a shot as a still for a target: the app full screen, or for a
// stage target, a phone screen on the stage. Returns the JPEG.
async function still(browser, name, target) {
  if (!target.stage) {
    const page = await openShot(browser, name, target);
    const jpeg = await page.screenshot({ type: 'jpeg', caret: 'initial', quality: 92 });
    reportErrors(name, page);
    await page.close();
    return jpeg;
  }
  return stageStill(browser, [name], target);
}

async function stageStill(browser, names, target) {
  const stage = await openStage(browser, target, names.length);
  const screens = [];
  for (const name of names) {
    const page = await openShot(browser, name, stage.screenTarget);
    screens.push(await page.screenshot({ type: 'jpeg', caret: 'initial', quality: 95 }));
    reportErrors(name, page);
    await page.close();
  }
  await stage.setScreens(screens);
  const jpeg = await stage.screenshot({ type: 'jpeg', quality: 92 });
  await stage.close();
  return jpeg;
}

// A title or end card: the lockup over the backdrop, tinted by a blurred frame
// of the next or previous clip, so the video fades into the card rather than
// cutting to a flat one
async function renderCard(browser, card, background, target, file) {
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: target.scale || 1,
  });
  const u = `${Math.min(target.width, target.height) / 100}px`;
  const landscape = target.width > target.height;
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS}${lockupCss(
    landscape ? `${Math.min(target.width, target.height) / 130}px` : u,
  )}
    html, body { margin: 0; height: 100%; overflow: hidden; }
    body { display: flex; align-items: center; justify-content: center; ${BACKDROP} }
    body::before { content: ''; position: fixed; inset: -8%; z-index: -1;
      background: url(data:image/jpeg;base64,${fs.readFileSync(background).toString('base64')}) center / cover;
      filter: blur(5vmin) brightness(0.6) saturate(1.1); opacity: 0.35; }
  </style>${lockupHtml(card)}`);
  await page.evaluate(() =>
    Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]),
  );
  await page.screenshot({ path: file });
  await page.close();
}

async function main() {
  let server = null;
  let buildDir = null;
  if (!base) {
    buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'counters-promo-'));
    console.log(`Building to ${buildDir} ...`);
    execSync(`npx vite build --outDir "${buildDir}" --emptyOutDir`, {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    server = await serveDir(buildDir);
    base = `http://localhost:${server.address().port}/`;
  }
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: mode !== 'open',
  });
  try {
    if (mode === 'open') {
      const target = TARGETS[process.env.TARGET || 'iphone'];
      const page = await openShot(browser, selected[0], target, { live: true });
      console.log(`${selected[0]} is open; close the window to finish.`);
      await new Promise((resolve) => page.on('close', resolve));
    }

    if (mode === 'sheet') {
      // The sheet target at a lower density, about 640 px on its longer side
      const full = TARGETS[process.env.SHEET || 'iphone'];
      const target = { ...full, scale: 640 / Math.max(full.width, full.height) };
      const files = [];
      for (const name of selected) {
        const file = path.join(OUT, `sheet-${name}.jpg`);
        fs.writeFileSync(file, await still(browser, name, target));
        files.push(file);
        console.log(file);
      }
      // Labelled by a page rather than ffmpeg, whose drawtext filter isn't in
      // Homebrew's ffmpeg
      const w = Math.round(target.width * target.scale);
      const h = Math.round(target.height * target.scale);
      const cols = Math.min(target.height > target.width ? 4 : 2, files.length);
      const rows = Math.ceil(files.length / cols);
      const page = await browser.newPage({ viewport: { width: cols * w, height: rows * h } });
      await page.setContent(
        `<style>body{margin:0;display:grid;grid-template-columns:repeat(${cols},${w}px);background:#000}
        figure{margin:0;position:relative;width:${w}px;height:${h}px}
        img{display:block;width:100%;height:100%}
        figcaption{position:absolute;left:8px;bottom:8px;padding:2px 6px;font:500 14px system-ui;
        color:#fff;background:rgba(0,0,0,0.6)}</style>` +
          files
            .map(
              (f, i) =>
                `<figure><img src="data:image/jpeg;base64,${fs
                  .readFileSync(f)
                  .toString('base64')}"><figcaption>${selected[i]}</figcaption></figure>`,
            )
            .join(''),
      );
      const sheet = path.join(OUT, 'sheet.jpg');
      await page.screenshot({ path: sheet, type: 'jpeg', quality: 85 });
      await page.close();
      console.log(sheet);
    }

    if (mode === 'artwork') {
      for (const name of selected) {
        const art = ARTWORK[name];
        const jpeg = await stageStill(browser, art.screens, art);
        const file = path.join(OUT, `${name}.${art.png ? 'png' : 'jpg'}`);
        if (art.png) {
          // The App Store wants a plain RGB PNG
          const tmp = path.join(OUT, `${name}-tmp.jpg`);
          fs.writeFileSync(tmp, jpeg);
          ffmpeg(['-i', tmp, '-pix_fmt', 'rgb24', file]);
          fs.rmSync(tmp);
        } else {
          fs.writeFileSync(file, jpeg);
        }
        console.log(file);
      }
    }

    if (mode === 'stills') {
      const stillTargets = (
        process.env.STILLS ||
        Object.keys(TARGETS)
          .filter((t) => !TARGETS[t].video)
          .join(',')
      ).split(',');
      for (const name of selected) {
        if (SHOTS[name].still === false) continue;
        for (const targetName of stillTargets) {
          const file = path.join(OUT, `${name}-${targetName}.jpg`);
          fs.writeFileSync(file, await still(browser, name, TARGETS[targetName]));
          console.log(file);
        }
      }
      console.log(writeViewer());
    }

    if (mode === 'video') await video(browser);
  } finally {
    await browser.close();
    if (server) server.close();
    if (buildDir) fs.rmSync(buildDir, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

async function video(browser) {
  const target = videoTarget;
  const pixelW = Math.round(target.width * (target.scale || 1));
  const pixelH = Math.round(target.height * (target.scale || 1));
  const clips = [];
  // The first clip's first frame and the last clip's last frame, as the
  // title and end cards' backgrounds
  const firstFrame = path.join(OUT, `${videoTargetName}-first-frame.jpg`);
  const lastFrame = path.join(OUT, `${videoTargetName}-last-frame.jpg`);
  const addCard = async (card, i, background) => {
    const png = path.join(OUT, `${videoTargetName}-card-${i}.png`);
    const mp4 = png.replace(/\.png$/, '.mp4');
    await renderCard(browser, card, background, target, png);
    ffmpeg([
      ...['-loop', '1', '-framerate', String(FPS), '-i', png],
      ...['-t', String(card.seconds), '-vf', `scale=${pixelW}:${pixelH}`, ...H264, mp4],
    ]);
    fs.rmSync(png);
    return { mp4, seconds: card.seconds, card: true };
  };
  for (const name of selected) {
    const shot = SHOTS[name];
    if (!shot.seconds) continue;
    const frameDir = path.join(OUT, `frames-${name}`);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
    const stage = target.stage ? await openStage(browser, target, 1) : null;
    const page = await openShot(browser, name, stage ? stage.screenTarget : target, {
      forClip: true,
    });
    const wanted = Math.round(shot.seconds * FPS);
    let frames = 0;
    const frameFile = (i) => path.join(frameDir, `${String(i).padStart(5, '0')}.jpg`);
    page.app.onFrame = async () => {
      const jpeg = await page.screenshot({ type: 'jpeg', caret: 'initial', quality: 95 });
      if (stage) {
        await stage.setScreens([jpeg]);
        await stage.screenshot({ path: frameFile(frames), type: 'jpeg', quality: 95 });
      } else {
        fs.writeFileSync(frameFile(frames), jpeg);
      }
      frames++;
      if (frames % FPS === 0) console.log(`  ${name}: ${frames}/${wanted} frames`);
    };
    if (shot.clip) await shot.clip(page.app);
    if (frames < wanted) await page.app.wait(((wanted - frames) * 1000) / FPS);
    if (frames > wanted) {
      console.warn(`  ${name}: the clip ran ${(frames / FPS).toFixed(1)} s, past its ${shot.seconds} s`);
    }
    reportErrors(name, page);
    await page.close();
    if (stage) await stage.close();
    if (!clips.length) fs.copyFileSync(frameFile(0), firstFrame);
    fs.copyFileSync(frameFile(frames - 1), lastFrame);
    const mp4 = path.join(OUT, `${videoTargetName}-clip-${name}.mp4`);
    ffmpeg([
      ...['-framerate', String(FPS), '-i', path.join(frameDir, '%05d.jpg')],
      ...['-vf', `scale=${pixelW}:${pixelH}`, ...H264, mp4],
    ]);
    fs.rmSync(frameDir, { recursive: true, force: true });
    clips.push({ mp4, seconds: frames / FPS });
    console.log(mp4);
  }
  const { titleCard, endCard } = target;
  const parts = [
    ...(titleCard ? [await addCard(titleCard, 0, firstFrame)] : []),
    ...clips,
    ...(endCard ? [await addCard(endCard, 1, lastFrame)] : []),
  ];
  fs.rmSync(firstFrame, { force: true });
  fs.rmSync(lastFrame, { force: true });

  // Edit: the parts joined by short crossfades between clips, and a slower dip
  // through black into and out of a card (a crossfade would show the stage's
  // logo and the card's on top of each other), with music faded in and out.
  // Without music the video still gets a silent audio track, which the App
  // Store expects of previews.
  const toCard = parts.slice(1).map((part, i) => !!(part.card || parts[i].card));
  const fades = toCard.map((card) => (card ? 1 : 0.5));
  let filter = '';
  let offset = 0;
  let last = '[0:v]';
  parts.slice(1).forEach((part, i) => {
    offset += parts[i].seconds - fades[i];
    filter += `${last}[${i + 1}:v]xfade=transition=${toCard[i] ? 'fadeblack' : 'fade'}:duration=${fades[i]}:offset=${offset.toFixed(3)}[x${i}];`;
    last = `[x${i}]`;
  });
  const total =
    parts.reduce((sum, p) => sum + p.seconds, 0) - fades.reduce((sum, f) => sum + f, 0);
  const audioIn =
    MUSIC === 'none'
      ? ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']
      : ['-ss', String(MUSIC_START), '-i', MUSIC];
  filter += `[${parts.length}:a]atrim=0:${total.toFixed(3)}`;
  if (MUSIC !== 'none') {
    filter += `,afade=t=in:d=1,afade=t=out:st=${(total - 2).toFixed(3)}:d=2`;
  }
  filter += '[a]';
  const file = path.join(OUT, `counters-${videoTargetName}.mp4`);
  ffmpeg([
    ...parts.flatMap((p) => ['-i', p.mp4]),
    ...audioIn,
    ...['-filter_complex', filter],
    ...['-map', parts.length > 1 ? last : '0:v', '-map', '[a]'],
    ...['-c:a', 'aac', '-b:a', '256k', ...H264],
    ...['-r', String(FPS), '-t', total.toFixed(3), '-movflags', '+faststart', file],
  ]);
  console.log(`${file} (${total.toFixed(1)} s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
