// Shot list for scripts/promo.js. Each shot is saved app state (counters,
// settings, history) plus taps that put the app in the moment to capture, so
// the assets can be re-rendered after visual changes. To adjust one, open it
// with `npm run promo:open -- <shot>` (a Chrome window in that state), try
// changes there, then edit the shot here.
//
// `setup(app)` runs after the app loads and before a still or a clip; `clip`
// (with `seconds`) is what happens during a video clip. Both get an app
// helper whose time is virtual: `app.wait(ms)` advances the app's clock (and,
// while filming, records the frames), so every render is the same.
//   app.tap(selector)        taps an element (a dot shows where, in videos)
//   app.wait(ms)             lets time pass
//   app.type(selector, text) types into a field, a key at a time
//   app.random(seed)         restarts the app's random numbers (dice rolls)

// Shared by every shot: no sounds, and the default palette and layout unless
// a shot picks its own
const BASE_SETTINGS = {
  soundEnabled: false,
  hapticsEnabled: false,
  palette: 'bold',
  layout: 'list',
  theme: 'light',
  topBarContent: 'highest',
};

const counter = (id, label, value, color, extra = {}) => ({
  id,
  label,
  value,
  color,
  increment: 1,
  resetValue: 0,
  ...extra,
});

// A game night: four players, Chloe ahead (sorted by score, as auto-sort
// keeps them)
const PLAYERS = [
  counter('chloe', 'Chloe', 51, 2),
  counter('alice', 'Alice', 42, 0),
  counter('ben', 'Ben', 37, 1),
  counter('dev', 'Dev', 29, 3),
];

const entry = (counterLabel, color, actionLabel, progression, timestamp) => ({
  id: timestamp.replace(/\D/g, ''),
  counterLabel,
  color,
  actionLabel,
  progression,
  timestamp,
});

// Newest first, as the app stores it
const GAME_HISTORY = [
  entry('Chloe', 2, '+15', '36 → 51', '08:42:10 PM'),
  entry('Dice roll', 'system', 'Rolled 2d6', 'Result: 9 (4 + 5)', '08:41:52 PM'),
  entry('Alice', 0, '+1', '41 → 42', '08:40:31 PM'),
  entry('Ben', 1, '+10', '27 → 37', '08:39:05 PM'),
  entry('Dev', 3, '−5', '34 → 29', '08:37:48 PM'),
  entry('Alice', 0, '+20', '21 → 41', '08:36:12 PM'),
  entry('Chloe', 2, '+12', '24 → 36', '08:34:40 PM'),
];

const card = (id) => `.counter-card[data-counter-id="${id}"]`;
const tab = (name) => `[data-tab-btn="${name}"]`;

// The app icon and name, with a tagline: beside the screens on stages with
// `logo`, and on the title card
const LOGO = { title: 'COUNTERS', tagline: 'Keep score of anything' };

// Title and end cards show the logo or just the name, plus lines of smaller
// text (the web address)

// Single images for other placements, each a stage (app screens over the
// app's background) at its own size: the YouTube thumbnail (with the app icon
// and name), and the App Store's product page header and search results asset
// (no text: the store shows the icon and name beside them; keep the subject
// near the center, as the edges can be cropped). `screens` lists the shots
// side by side; `png` saves a PNG (RGB, no alpha) instead of a JPEG.
const ARTWORK = {
  thumbnail: {
    screens: ['scoreboard', 'dice', 'timer'],
    width: 1280,
    height: 720,
    logo: true,
  },
  // 3840x1646. App Store Connect takes the header only as a PNG (it calls a
  // JPEG's dimensions invalid), though it takes the search results as a JPEG
  'appstore-header': {
    screens: ['palettes', 'scoreboard', 'dice', 'timer', 'habits'],
    width: 1920,
    height: 823,
    scale: 2,
    png: true,
  },
  // 3840x2560
  'appstore-search': {
    screens: ['scoreboard', 'dice', 'timer'],
    width: 1920,
    height: 1280,
    scale: 2,
  },
  // Google Play's feature graphic
  'play-feature': {
    screens: ['palettes', 'scoreboard', 'dice'],
    width: 1024,
    height: 500,
    logo: true,
  },
};

// Output targets: CSS size, pixel density (scale), touch device (mobile) and,
// for videos, an optional title card before the clips and end card after
// them. Portrait device targets are the app itself, full screen; the others
// (`stage`) show the app as a phone screen over a background, with the logo
// beside it (`logo`). A target's `settings` apply over every shot's (the
// iPad's wide screen suits the grid layout). App Store sizes:
// iPhone 6.9" and 6.3" screenshots, iPhone previews (one size for both), and
// iPad 13" screenshots and previews (portrait).
const TARGETS = {
  iphone: { width: 440, height: 956, scale: 3, mobile: true }, // 1320x2868
  // iPhone with Dynamic Island, medium display (6.3"): the size App Store
  // Connect requires; it doesn't take the larger iPhone's screenshots
  'iphone-medium': { width: 402, height: 874, scale: 3, mobile: true }, // 1206x2622
  ipad: { width: 1032, height: 1376, scale: 2, mobile: true, settings: { layout: 'grid' } }, // 2064x2752
  web: { width: 1920, height: 1080, stage: true, logo: true },
  social: { width: 1200, height: 630, stage: true, logo: true },
  // App Store previews: 15-30 s, in-app footage, no web address. They open
  // straight on the app (they autoplay muted in search results, and the app's
  // name and icon are already beside them)
  'iphone-preview': {
    width: 443,
    height: 960,
    scale: 2, // 886x1920
    mobile: true,
    video: true,
    endCard: { ...LOGO, seconds: 2.5 },
  },
  'ipad-preview': {
    width: 900,
    height: 1200,
    scale: 4 / 3, // 1200x1600
    mobile: true,
    settings: { layout: 'grid' },
    video: true,
    endCard: { ...LOGO, seconds: 2.5 },
  },
  // The website, YouTube and Google Play
  trailer: {
    width: 1920,
    height: 1080,
    stage: true,
    logo: true,
    video: true,
    titleCard: { ...LOGO, seconds: 2.5 },
    endCard: { title: LOGO.title, lines: ['counters.cowneck.com'], seconds: 3 },
  },
};

// `seconds`: a video clip of that length (in list order). `still: false`
// leaves it out of the stills. Each shot starts from a fresh app with its own
// `counters`, `settings` (over BASE_SETTINGS) and `history`.
const SHOTS = {
  // The scoreboard: a game night in progress, sorted by score. In the video,
  // Dev scores a few points, then Ben's +15 takes the lead and auto-sort
  // moves him to the top
  scoreboard: {
    counters: PLAYERS,
    settings: { autoSort: true },
    history: GAME_HISTORY,
    seconds: 7,
    async clip(app) {
      await app.wait(500);
      for (let i = 0; i < 3; i++) {
        await app.tap(`${card('dev')} .card-direct-zone-plus`);
        await app.wait(450);
      }
      await app.tap(`${card('ben')} .card-value-body`);
      await app.wait(900);
      await app.tap('#calc-quick-add-container button[data-quick-val="15"]');
      // Auto-sort waits 3 s after the last change, then moves the cards
      await app.wait(4000);
    },
  },
  // Adding points with the calculator
  calculator: {
    counters: PLAYERS,
    history: GAME_HISTORY,
    async setup(app) {
      await app.tap(`${card('alice')} .card-value-body`);
      await app.wait(600);
      await app.type('#calc-number-input', '12');
      await app.wait(300);
    },
    seconds: 4,
    async clip(app) {
      await app.wait(400);
      await app.tap('#calc-btn-submit');
      await app.wait(1500);
    },
  },
  // The grid layout in dark theme with the Vaporwave palette
  palettes: {
    counters: [
      counter('red', 'Red team', 18, 1),
      counter('blue', 'Blue team', 24, 0),
      counter('green', 'Green team', 21, 6),
      counter('gold', 'Gold team', 15, 4),
      counter('round', 'Round', 7, 7),
      counter('fouls', 'Fouls', 3, 3),
    ],
    settings: { theme: 'dark', layout: 'grid', palette: 'vaporwave' },
  },
  // Rolling dice: 3d6 after a roll
  dice: {
    counters: PLAYERS,
    history: GAME_HISTORY,
    async setup(app) {
      await app.tap(tab('dice'));
      await app.wait(600);
      await app.tap('#btn-dice-plus');
      await app.tap('#btn-dice-plus');
      await app.wait(200);
      app.random(31); // 5 + 6 + 5
      await app.tap('#btn-roll-action');
      await app.wait(1500);
    },
    seconds: 4,
    async clip(app) {
      await app.wait(400);
      await app.tap('.dice-type-btn[data-type="20"]');
      await app.wait(500);
      app.random(36); // 20 + 19 + 6
      await app.tap('#btn-roll-action');
      await app.wait(2500);
    },
  },
  // The stopwatch running, glowing
  timer: {
    counters: PLAYERS,
    async setup(app) {
      await app.tap(tab('timer'));
      await app.wait(600);
      await app.tap('#btn-timer-placeholder-start');
      await app.wait(12_400);
    },
    seconds: 3,
    async clip(app) {
      await app.wait(3000);
    },
  },
  // The history of a game
  history: {
    counters: PLAYERS,
    history: GAME_HISTORY,
    settings: { theme: 'dark' },
    async setup(app) {
      await app.tap('#btn-open-history');
      await app.wait(800);
    },
  },
  // Counting more than games: daily habits, in the Pastel palette
  habits: {
    counters: [
      counter('water', 'Glasses of water', 6, 0),
      counter('pushups', 'Push-ups', 40, 4, { increment: 10 }),
      counter('pages', 'Pages read', 32, 2),
      counter('steps', 'Coffee', 2, 5),
    ],
    settings: { palette: 'pastel', topBarContent: 'total' },
  },
};

module.exports = { BASE_SETTINGS, LOGO, ARTWORK, TARGETS, SHOTS };
