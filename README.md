# Counters

A minimalist, premium web application for tracking scores, counters, and general game states. Built with vanilla HTML, CSS, and JavaScript with a focus on polished UI, responsive micro-interactions, and offline-first capabilities.

## Features

- **Dynamic counters**: Add, edit, delete, and individually theme players or counters.
- **Calculator overlay**: A custom bottom-sheet numeric calculator for quickly adding or subtracting complex values without mental math.
- **Complete history log**: A persistent transaction log tracking every score change, reset, and direct manipulation.
- **Dice and timer**: Includes built-in utilities like a quick D6 dice roller and a precision stopwatch/timer.
- **Rich user experience**: Features customized sounds (Web Audio API synthesis), haptic feedback patterns, and smooth CSS-driven animations.
- **Offline and persistent**: Saves all state completely locally via the browser's `localStorage` so you never lose your progress.
- **Auto-sorting**: Automatically arrange counters by highest or lowest score with intelligent debounce timing to prevent UI jumping during active edits.
- **Dark/light mode**: Full support for system-level color schemes or forced Dark/Light theming.

## Development and usage

Because Counters is built with zero dependencies using pure vanilla web technologies, you don't need any complex build steps.

To run the application locally, you can use any static server. For example:
```bash
# If using Node.js
npx serve .

# Or using Python
python -m http.server 3000
```

Then navigate to `http://localhost:3000` (or whatever port your server starts on) in your web browser.

## Browser support

Counters is designed to run on any modern web browser. It leverages modern APIs including:
- Dialog element (`<dialog>`) and standard `command="close"` attributes.
- CSS Variables and standard grid/flexbox layouts.
- Web Audio API for synthetic audio feedback.
- `navigator.vibrate` for tactile response on supported mobile devices.
