# Agents guidelines

Guidelines and rules for AI coding assistants working in the Counters repository.

## UI copy & iconography rules

* **Title capitalization style**: Always use **Sentence case** for all user-facing titles, labels, tooltips, buttons, dialog headers, and text values. This rule also strictly applies to all documentation titles, headers, and subheaders in the repository (e.g. in markdown files).
  * *Correct*: "Add counter", "Edit counter", "Delete counter", "Reset score", "Display options", "Open history".
  * *Incorrect*: "Add Counter", "Edit Counter", "Delete Counter", "Reset Score", "Display Options", "Open History".

## Git & workflow rules

* **Manual commits only**: Do not create git commits automatically. When a task or skill reaches a commit point, you must stop, stage the changes, and ask for explicit permission before committing.
* **No standing permission**: A previous approval to commit (e.g., "go ahead and commit") applies ONLY to the currently staged changes. It does NOT grant permission for any future commits.
* **Never chain commits**: If you complete a follow-up task, you must ask for permission AGAIN before committing. Do not assume "go ahead and commit" means "commit everything I do from now on."
* **Verification first**: Always run the relevant verification/test command before asking to commit, but do not proceed to the `git commit` command yourself.
* **Isolated production commits**: Keep updates to the production build (files under the `docs/` directory) completely isolated in their own commits, separate from dev source code changes.
  * **No automatic production builds**: Never generate a production build (`npm run build` or updating the `docs/` folder) unless the USER explicitly requests it.
  * Making regular source changes (e.g., editing `app.js` or `index.html`) should be committed in small, clean, source-only commits first.
  * Generating a production build should be treated as an intentional, independent step only executed upon direct USER request.
  * **Exception**: You should bundle the version bump (updating `package.json` and `package-lock.json`) in the same commit as the production build, as generating a new build often corresponds with a version release.

## Server & verification rules

* **Dev server**: `npm run dev` starts the Vite dev server, by default at `http://localhost:5173`. One may already be running in another terminal, so check before starting another. Watch for port conflicts: if 5173 is taken, Vite quietly moves to the next free port (5174, 5175, …), and the server on 5173 may belong to a different project entirely. Confirm the page title is "Counters" before verifying against a server. Avoid browser-based verification unless it is absolutely necessary.
* **Headless tests**: Prefer `npm run test:e2e` (Playwright, headless Chrome) over manual browser checks. It starts its own Vite server on port 5199 (or reuses one already there), so it doesn't depend on or conflict with a dev server. Set `BASE_URL` to test a different server. Tests live in `tests/e2e/` and should import `test`/`expect` from `./fixtures.js`, which blocks third-party requests and fails on uncaught page errors. Run it when changing UI behavior or startup/network code. The slow contrast sweep (tagged `@contrast`) is left out of it; run `npm run test:contrast` when changing colors, themes or palettes.

## Directory rules

* **Do not touch the docs directory**: The `docs/` directory is strictly for compiled production builds generated automatically by Vite. Never edit, search, or read files inside the `docs/` directory. All development, changes, and queries must be executed against the root source files (like `app.js`, `index.css`, root `index.html`, etc.).

## Code hygiene & lint rules

* **Zero lint warnings standard**: The codebase maintains a strict zero-warning policy enforced by `npm run lint` (`eslint . --max-warnings=0`). Never propose or stage commits that introduce ESLint warnings or errors. Always run `npm run lint` or `npm test` as part of your verification pass before asking for commit approval.
* **Code hygiene best practices**:
  * Use optional catch binding (`try { ... } catch { /* ignore */ }`) when the error object is unused, rather than `catch (e)` or empty blocks without comments.
  * Remove dead or leftover variables immediately during refactoring rather than leaving unused declarations.
  * Do not leave unused function arguments or destructured variables from imports or constants.

## Logging & console rules

* **Use the log utility**: Avoid raw `console.log` calls in runtime application code. Use the `log` utility methods (`log.info`, `log.warn`, `log.error`) provided by `logger.js`.
* **Gate diagnostic output**: Use `log.info` for operational milestones and debug events. These logs are automatically suppressed by default and only print when debug mode is active (`?debug=1`, `?debug=true`, `localStorage.getItem('debug') === 'true'`, or `window.DEBUG = true`).
* **Preserve warnings and errors**: Use `log.warn` and `log.error` for genuine warnings, recoverable failures, or unexpected conditions.
* **Single startup banner**: Only the main entry file (`app.js`) prints a single, unguarded startup banner displaying the app title, version, and commit hash. Do not add other unguarded console outputs on startup.

## Release notes generation

* **Release notes command**: When the user requests you to generate release notes (e.g., by saying "generate release notes" or after running `npm run release`), review the git commit history since the last version bump.
* **Append to RELEASE_NOTES.md**: Write the new release notes directly to the top of `RELEASE_NOTES.md`.
* **Length limit**: Each version entry MUST be kept concise and explicitly limited to a maximum of **500 characters** per entry.
* **Formatting**: Use sentence case for bullet points. Group changes into bolded categories (e.g., `* **Counters:** Added ...`).

