# Counters

## Store metadata

<!-- Copy-ready metadata assets for store listings (Google Play Store, Apple App Store, and other distribution platforms). Storing these in version control ensures consistent description updates across platforms. -->

### App title

<!-- Max 30 characters -->

Counters

### Description

<!-- Max 4,000 characters -->

Counters is a minimalist app designed for counting things, like scores in games.

Features:

- Dynamic counters: Add, edit, delete, and set custom colors for individual counters.
- Calculator overlay: Tap a counter to add or subtract custom values or quick-add presets.
- Dice roller: Roll dice (d4 to d20) with adjustable quantities.
- Stopwatch/timer: Track intervals or count down using quick-add presets.
- History log: Record all counter adjustments, resets, and dice rolls.
- Offline persistence: Save all app states locally to resume instantly.
- Shuffle decider: Randomize counter order to determine play order.
- Total value: View the combined sum of all active counters.
- Counter sorting: Sort counters automatically by value, or drag and drop to reorder.
- Device themes: Support system light and dark modes with customizable color accents.

### Keywords

<!-- Max 100 characters -->

score,tracker,counter,game,boardgame,tally,dice,timer,points,life,calculator,habit,shuffle,mtg,dnd

## Development and deployment

Counters uses Vite for fast local development and optimized production bundling.

### 1. Install dependencies

Install the required development tools:

```bash
npm install
```

### 2. Run locally

Start Vite's development server with hot module replacement:

```bash
npm run dev
```

Then open the local URL (usually `http://localhost:5173`) in your web browser.

### 3. Run tests

Lint the code, then run the Playwright end-to-end tests in headless Chrome. The tests start their own Vite server on port 5199:

```bash
npm run lint
npm run test:e2e
```

The contrast sweep checks text and icon contrast for every palette in both themes. It's slow, so `test:e2e` leaves it out. Run it on its own after changing colors, themes or palettes:

```bash
npm run test:contrast
```

### 4. Production release

To bundle the application and output a production release to the `docs` directory (configured for easy hosting on GitHub Pages):

```bash
npm run build
```

Alternatively, you can run the release pipeline which checks the working tree, lints, and runs the e2e tests, then increments the patch version in `package.json` and builds the production bundle in one step:

```bash
npm run release
```

The pipeline runs these steps in order:

1. Checks that the working tree is clean (no uncommitted changes)
2. Runs ESLint
3. Runs the Playwright e2e tests (`npm run test:e2e`, without the contrast sweep)
4. Bumps the patch version in `package.json`
5. Syncs the version into the app via `scripts/sync-version.js`
6. Builds the production bundle into `docs/`

To skip the e2e tests (e.g. when tests are known to be failing for unrelated reasons), pass `--skip-tests`:

```bash
npm run release -- --skip-tests
```

### 5. Promotional screenshots and video

```bash
npm run promo:sheet [-- shot ...]     # small renders and a contact sheet, for review
npm run promo:stills [-- shot ...]    # each shot for each still target
npm run promo:view                    # open promo/index.html, a page for browsing the stills
npm run promo:artwork [-- name ...]   # single images: the YouTube thumbnail (1280x720), the App Store header (3840x1646, a PNG: App Store Connect rejects a JPEG header) and search results asset (3840x2560), and Google Play's feature graphic (1024x500)
npm run promo:video -- <target>       # the clips, then the edited video (iphone-preview, ipad-preview or trailer)
npm run promo:open -- <shot>          # a Chrome window with the shot set up, to adjust it
```

Renders the shots in `scripts/promo-shots.js`. Each shot is saved app state (counters, settings, history) plus a few scripted taps, so the chosen moments live in source control and re-render after visual changes. To change one, open it with `promo:open`, try changes there, then edit the shot. `TARGETS` there sets the outputs: App Store screenshots for iPhone 6.9" (1320x2868) and 6.3" (1206x2622, the size App Store Connect requires) and iPad (2064x2752, in the grid layout), the website (1920x1080) and social sharing (1200x630), and the videos: App Store previews for iPhone (886x1920) and iPad (1200x1600), which open straight on the app and end on the icon, name and tagline, and a 1920x1080 trailer for the website, YouTube and Google Play, which opens on the icon and name and ends with the web address. Device targets show the app full screen; the landscape ones show it as a phone screen over a dark backdrop, beside the icon and name. In videos, a soft dot shows each tap. The video is the clips (shots with `seconds`, in list order) between the target's title and end cards, joined by crossfades, with a silent audio track (`MUSIC=file` adds music).

It builds the app into a temporary directory (never `docs/`), or uses `APP_URL` (e.g. the dev server), and blocks third-party requests so renders stay out of analytics. Output goes to `promo/` (`OUT=dir`, ignored by git). `stills` also writes `promo/index.html`, a page for browsing the stills by device or by shot. Every shot runs on a virtual clock: Playwright's clock drives the app's timers and animation frames, and the page's CSS animations, transitions and smooth scrolls are stepped with it, so renders come out the same every time. Dice rolls use seeded random numbers. Clips advance exactly 1/30 s per frame. Options: `SHEET` (the target the contact sheet shrinks, default `iphone`), `STILLS` (comma-separated still targets), `TARGET` (the target `promo:open` emulates, default `iphone`) and `FPS` (30). Needs `ffmpeg` (`brew install ffmpeg`) and Chrome.
