# Release notes

## 0.0.6

- **Timer:** Implemented a dual-mode stopwatch and dynamic countdown timer with adjustable time increments and increased update frequency.
- **User interface:** Refined the dice layout, standardized glassmorphic backgrounds for navigation bars, and simplified the empty state UI.
- **Analytics & improvements:** Added Google Analytics tracking, updated the calculator submit button to dynamically reflect values, and resolved timer reset bugs.

## 0.0.5

- **Animations:** Added smooth entry and exit transitions for cards and dialogs using discrete transition behaviors.
- **Dice roller:** Redesigned the dice roller with adjustable types and counts, and integrated rolls directly into the history log.
- **Refining & polish:** Standardized internal properties to "counters", logged deletions to history, and redesigned empty state UI.

## 0.0.3

- **Responsiveness:** Constrained app width for desktop screens (>1024px) and improved mobile modal positioning using safe-area insets.
- **User interface:** Unified history dialog with bottom-sheet-dialog styles, refined the calculator with themed header pills, and optimized card hover effects for touch/mouse devices.
- **Refactoring:** Standardized terminology strictly to "counter" across the codebase and styled flex sizing.

## 0.0.2

- **Calculator improvements:** Refactored quick-add buttons to apply scores instantly, replaced long-press with direct clicks, and migrated custom keypad to a native number input.
- **Interactions:** Added long-press gesture for editing values, streamlined adding new counters with automatic placeholders, and optimized card drag animations using `translate3d`.
- **Theming:** Implemented dynamic bottom-sheet theme matching based on counter colors, and improved layout responsiveness.

## 0.0.1

- **Initial launch:** Initialized the minimalist counter application featuring multiple tabs (counters, dice, timer), custom audio synthesis, and full theme support.
- **State management:** Integrated local state management, persistent local storage, manual drag-to-sort reordering, and transaction history.
- **User interface:** Optimized mobile layout with PWA support, bottom sheet swipe-to-dismiss gestures, custom SVG favicon, and keyboard accessibility.
