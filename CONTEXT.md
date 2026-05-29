# Project Context

## Architecture

"Counters" operates entirely on the client-side utilizing vanilla web technologies without any heavy frameworks (no React, Vue, or build steps like Webpack). 

The application is structured into three primary files:
- `index.html`: Contains the structural semantic markup, modal definitions, bottom sheet dialogs, and SVG icons.
- `index.css`: Houses a modern, CSS-variable driven design system handling everything from typography and component styling to responsive dark/light mode toggles.
- `app.js`: The central JavaScript controller managing internal state, DOM binding, logic events, animations, sounds, and persistent storage.

## State management

Application state is held inside the global `state` object in `app.js`. It tracks:
- `counters`: An array of player objects (id, name, score, color, increment, resetValue).
- `settings`: An object holding user preferences (sound, haptics, theme, autoSort, pointsToWin, topBarContent, quickAddValues).
- `history`: An array of transaction objects tracking time, player, action, and score diffs.

Whenever state is mutated, it is simultaneously flushed to `localStorage` using keys prefixed with `counters-` (e.g. `counters-list`, `counters-settings`). On application boot, the state is re-hydrated from `localStorage`.

## Development rules

To maintain consistency throughout the codebase, all future modifications must adhere to the following rules:
- **Sentence case**: All titles, headers, labels, and button text across the app (and within documentation) must strictly use sentence case (e.g., "Display options" instead of "Display Options").
- **Minimalist design**: Maintain the clean, vanilla CSS design language without relying on external frameworks.
- **Native features**: Prioritize modern browser APIs (like `<dialog>`, `Intl`, Web Audio API) over polyfills or third-party libraries whenever possible.
