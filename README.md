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
