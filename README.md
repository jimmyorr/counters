# Counters

## Promotional text

<!-- Max 170 characters -->
Counters is an app for counting things.

## Description

<!-- Max 4,000 characters -->
Counters is a minimalist app for tracking scores, life totals, and game states. Use it for board games, daily habits, or custom scoring systems.

Features:

• Dynamic counters: Add, edit, delete, and theme individual counters.
• Smart calculator overlay: Quickly add or subtract values using the built-in calculator.
• Complete history log: Records every single score change and reset.
• Built-in utilities: Includes a dice roller and a precision stopwatch/timer.
• Offline & persistent: Game state is saved completely locally. Resume exactly where you left off.
• Shuffle & decider: Shuffle your counters with a single tap to randomly determine play order.
• Total value display: Optional summary view to see the combined total value of all active counters.
• Auto-sorting: Automatically arrange counters by highest or lowest score.
• Dark & light modes: Fully supports your device's system-level color schemes.

## Keywords

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
