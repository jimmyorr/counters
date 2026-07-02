# Release notes

## 0.1.3

- **UI fixes:** Fixed an issue where the calculator dialog would stretch vertically on iPad.

## 0.1.2

- **Analytics:** Configured Google Analytics for native platforms and updated the web tracking ID.
- **About page:** Redesigned with an animated background, store download links, and a browser playback button.

## 0.1.1

- **Interactions:** Expanded calculator toggle hit area, auto-focused inputs synchronously, and allowed clicking labels during drags.
- **Accessibility:** Disabled focus rings globally for pointer taps for a native feel, while preserving keyboard a11y.
- **Settings:** Configured keep-awake lock to automatically re-apply upon resuming from the background.

## 0.1.0

- **Launch:** Initial release to the iOS App Store!
- **Refining & polish:** Overhauled app metadata, streamlined feature descriptions in the About page, and refined theme management styles for production.

## 0.0.18

- **Animations:** Added smooth FLIP animations for shuffling, dynamic falling effects for deletions, reset animations, and a confetti explosion for perfect shuffles.
- **Analytics:** Integrated Capacitor Firebase Analytics for cross-platform compliance and dynamic initialization, updating the privacy policy accordingly.
- **Build:** Updated Capacitor runtime, dependencies, and service worker assets for production.

## 0.0.13

- **Settings:** Added a "Keep screen awake" toggle functionality using native Capacitor plugins and the Web Wake Lock API.
- **User interface:** Implemented a unified site-wide styling system, optimized font sizes for grid display elements, and fixed padding to respect device safe area insets.
- **PWA support:** Added web app manifest, custom icon assets, and support for home screen installation.

## 0.0.12

- **Calculator:** Expanded submit button layout, capped input length to prevent precision bugs, and truncated overflow text.
- **Accessibility:** Added adaptive contrast blending for dialog title pills, improving legibility across themes.
- **User interface:** Fixed flex layout to prevent squishing on large numbers and restored minimum widths.

## 0.0.11

- **Customization:** Added a custom color picker to set individual counter hex colors, separate from the primary app theme.
- **User interface:** Reorganized the settings menu to group theme options under Appearance and consolidate quick-add preferences.
- **Accessibility:** Added focus rings to toggle switches and converted the top leader indicator into a keyboard-accessible button.

## 0.0.10

- **User interface:** Increased counter label sizes for better visibility, condensed the edit counter layout onto a single line, and removed extraneous help text.
- **Interactions:** Moved destructive "Delete" and "Clear history" actions to the top left of their dialogs to prevent accidental taps near the close button.

## 0.0.9

- **Customization:** Added a dynamic theme color hue slider in Settings to personalize the entire app's primary color.
- **Accessibility:** Implemented WCAG AA focus rings, auto-focus rules for safe dialog actions, and preserved input focus across renders.
- **Native features:** Integrated Capacitor for iOS and Android support, migrating state management to native `@capacitor/preferences`.
- **Refining:** Standardized design tokens, typography, and fixed sorting bugs.

## 0.0.7

- **Interactions:** Auto-focus and select text content when editing counter labels or focusing input fields.
- **User interface:** Replaced empty state elements with a single unified interaction card, updated active color swatch styling, and hid math input spinners.
- **Refactoring:** Renamed internal counter properties from "name" to "label" and streamlined history and timer logic.

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
