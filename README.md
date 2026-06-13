# Counters

## Store metadata

<!-- Copy-ready metadata assets for store listings (Google Play Store, Apple App Store, and other distribution platforms). Storing these in version control ensures consistent description updates across platforms. -->

### App title

<!-- Max 30 characters -->

Counters

### Promotional text

<!-- Max 170 characters -->

Counters is an app for counting things.

### Description

<!-- Max 4,000 characters -->

Counters is a minimalist app for tracking scores, life totals, and game states. Use it for board games, daily habits, or custom scoring systems.

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

### 3. Production release

To bundle the application and output a production release to the `docs` directory (configured for easy hosting on GitHub Pages):

```bash
npm run build
```

Alternatively, you can run the release pipeline which increments the patch version in `package.json` and builds the production bundle in one step:

```bash
npm run release
```
