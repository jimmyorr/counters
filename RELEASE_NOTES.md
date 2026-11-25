# Release notes

## 0.3.5

* **Debug:** Renamed the hidden `palettes.html` workbench to `debug.html` and rebranded it as Debug.

## 0.3.4

* **Palettes:** Added laptop multi-finger Picker controls, a segmented Sound on/off switch, shared app styling and color math, and a service worker bypass so `/palettes.html` loads directly in normal browser tabs.

## 0.3.3

* **Palettes:** Added a hidden `palettes.html` debug lab for previewing candidate and dynamic palettes, Picker instruments, and color-vision contrast against the live app.

## 0.3.2

* **Picker:** Kept held shapes anchored in place when a second finger touches down, only dragging once pulled past a 12px leash.

## 0.3.1

* **Picker:** Added a 2-teams mode toggle in the header that splits players into balanced teams with shared colors and shapes.
* **Audio:** Added harmonic chord cues to Picker with distinct palette instruments, major chords in light mode, and minor chords in dark mode.

## 0.3.0

* **Calculator:** Replaced the system keyboard with a built-in number pad featuring separate Add and Subtract actions, a +/− switch for quick-add presets, and full hardware keyboard support.
* **Dialogs:** Automatically scrolled focused inputs into view when the software keyboard shrinks an open bottom sheet.

## 0.2.7

* **Navigation:** Smoothly faded Counters-only header controls in and out as you swipe between tabs and cross-faded the header title across views.

## 0.2.6

* **Settings:** Moved quick-add values onto a single inline row and tightened footer spacing so Settings fits on a single screen without scrolling.

## 0.2.5

* **Settings:** Added direct App Store and Google Play links for web visitors without browser sniffing.
* **Web:** Removed deprecated iOS full-screen meta tag and layout-shrinking keyboard flag so Android Chrome uses its native visual-viewport keyboard behavior.

## 0.2.4

* **iOS:** Removed the legacy translucent status-bar override and viewport gap workarounds so Home screen installs fill the screen and tint the status bar in light and dark mode.
* **Updates:** Checked for service worker updates when returning to the foreground so installed web apps pick up new releases sooner.

## 0.2.3

* **iOS:** Kept the bottom tab bar fully visible inside the page viewport when launched from the Home screen.

## 0.2.2

* **Picker:** Centered all spinning shapes on their exact pivot, anchored drop shadows in place, and smoothed peak rotation speed so shapes spin evenly without wobbling.
* **iOS:** Extended the app shell into the missing bottom viewport band when launched from the Home screen.

## 0.2.1

* **Picker:** Added a multi-touch picker tab that places spinning shapes under each finger and crowns a random winner with haptics and a full-screen color flood.
* **Haptics:** Enabled haptic feedback on mobile web browsers that support vibration.
* **Dialogs:** Locked the background layout while bottom sheets and the software keyboard are open so cards underneath no longer shift.

## 0.2.0

* **Counters:** Widened the score tap target on counter cards so opening the calculator is easier without hitting − or +.
* **Dialogs:** Back now closes the topmost open sheet when a confirmation dialog sits over History.
* **Security:** Updated build dependencies.

## 0.1.30

* **Settings & touch:** Segmented theme picker, palette preview cards, sheet flick-to-dismiss physics, smoother drag-reordering, selection haptics, and native status-bar/back support.
* **Visuals & contrast:** Subtle leader-tinted ambient glow and WCAG AA contrast across all theme hues, palettes, and custom colors.
* **Accessibility & polish:** Keyboard tab navigation, reorder buttons in the edit sheet, cleaner decimal math, and Open Graph metadata.

## 0.1.29

* **Settings:** Added a link to the iOS App Store for web visitors.
* **Security:** Updated dependencies and completed Capacitor migration.

## 0.1.28

* **Animations:** Deleted counters now tumble out in front while the rest slide into place, and Undo shows right away. Delete all ends with the empty state rising in, with no blank pause. Reset counts the values down instead of flipping the cards.

## 0.1.27

* **Dialogs:** On Safari and iOS, sheets and menus now slide or fade away when closed, with the frosted backdrop fading out, instead of vanishing.

## 0.1.26

* **Settings:** A shorter page with no section headings or repeated help text, so it fits small phones.
* **Visuals:** The frosted blur behind the header, nav bar and dialogs works again in Chrome and on Android.
* **Security:** Updated Capacitor to 8.5.2.
* **Dev:** New `npm run promo:*` renders for App Store screenshots, artwork, previews and a trailer.

## 0.1.25

* **Timer:** The stopwatch glow pulses more slowly, and the stopwatch display now has the same border style as the dice result.
* **Dev:** The slow contrast sweep runs on its own with `npm run test:contrast`, so `npm run test:e2e` and releases finish faster. The README now documents the test commands.

## 0.1.24

* **Edit dialog:** Save now works on the first tap with the keyboard up.
* **Timer:** The stopwatch display glows and slowly pulses while running.
* **Touch screens:** Buttons no longer keep a hover highlight after being tapped.

## 0.1.23

* **Edit dialog:** With the keyboard up, the edit dialog now fills the space above it with Save pinned right on the keyboard, and nothing scrolls. Tighter spacing so it fits on small phones. Hid the iOS keyboard's prev/next/done bar.

## 0.1.22

* **Contrast:** Leader pill arrow and outline stay visible for pale colors in light theme and dark colors in dark theme. Calculator title readable for very dark colors. Card −/+ buttons more visible. Card names readable on mid-tone custom colors.
* **Dev:** New e2e contrast check across themes, palettes and counter surfaces.

## 0.1.21

* **Edit dialog:** Reverted the keyboard-open sheet resizing shipped in 0.1.19 and 0.1.20 — it caused more layout problems than it solved.

## 0.1.20

* **Edit dialog:** With the keyboard open, bottom sheets now leave clearance below the status bar instead of running to the top of the screen.

## 0.1.19

* **Edit dialog:** Bottom sheets now shrink to the visible area when the keyboard opens, so the dialog header stays on-screen; the edit dialog's save and reset buttons stay pinned while the fields scroll, and the focused field scrolls into view.

## 0.1.18

* **Internal:** HTML formatting cleanup.

## 0.1.17

* **Palettes:** Fixed palette preview in settings — swatches now stay on one row on tablet/desktop and only wrap on small screens.
* **Dev:** `npm run release` accepts `--skip-tests` to bypass the e2e suite when needed.

## 0.1.16

- **Palettes:** Added a color-blind friendly palette.
- **UX:** Simplified the card header — tap the title to edit; reset moved into the editor.
- **Bug fixes:** Fixed a typing race condition when renaming a new counter. Settings help text kept clear of controls.

## 0.1.15

- **Palettes:** Added Vintage, Nautical, and Vaporwave; redesigned Bold and Pastel palettes with hue-ordered swatches and improved narrow-screen layout.
- **Typography:** Lightened the app and settings titles for improved readability.

## 0.1.13

- **Accessibility:** Screen readers now announce counter names, values, and toasts. Card text switches to black or white for contrast, pinch zoom works, and reduced motion is respected.
- **Bug fixes:** Fixed a long press with auto-sort on also opening the label editor, and typing jumping between edit fields.
- **Code cleanup:** Removed about 430 lines of dead and duplicated code.

## 0.1.12

- **Bug fixes:** Fixed the timer losing time when adding time while running, deleting the wrong counter during auto-sort, and the calculator ignoring Enter.
- **Reliability:** Stopped two open tabs overwriting each other, saved the theme with other settings, and bundled fonts so a slow network can't block startup.
- **Developer experience:** Added a Playwright test suite that runs before every release.

## 0.1.10

- **Sharing:** Added sharing all counters from the main menu.
- **Undo:** Added undo to the counter deleted toast, plus reset all and delete all.
- **Bug fixes:** Allowed decimals consistently in edit dialogs and validated quick-add input instead of silently dropping bad values.

## 0.1.9

- **Bug fixes:** Fixed card resets to honor configured values, sanitized counter labels in HTML, synced bottom navigation accessibility states, and cleared stale leader pill text.
- **Developer experience:** Added a structured logger with startup banner, release verification checks, and enforced zero lint warnings.

## 0.1.5

- **Navigation & gestures:** Added fluid horizontal swipe navigation between tabs with peek effects and card hold delay.
- **Drag & drop:** Improved grid slot targeting and eliminated gesture conflicts during tab swipes.
- **Haptics & animations:** Added native haptics for reset/delete actions and improved score reset flip animations.

## 0.1.4

- **UI & animation:** Added smooth auto-sorting animations, timer shake/pop effects, and denied drag feedback.
- **Audio & haptics:** Added Capacitor haptics, timer countdown beeps, and reduced audio fatigue on menus.
- **Bug fixes:** Resolved View Transition UI glitches, forced immediate sorts on setting changes, and fixed 3-digit layouts.

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
