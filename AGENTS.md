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

* **Use existing server**: Do not start a local development server (e.g., `npm run dev`). A development server is already running on port 5173. Use `http://localhost:5173` for all browser-based verification. Avoid browser-based verification unless it is absolutely necessary.

## Directory rules

* **Do not touch the docs directory**: The `docs/` directory is strictly for compiled production builds generated automatically by Vite. Never edit, search, or read files inside the `docs/` directory. All development, changes, and queries must be executed against the root source files (like `app.js`, `index.css`, root `index.html`, etc.).

## Release notes generation

* **Release notes command**: When the user requests you to generate release notes (e.g., by saying "generate release notes" or after running `npm run release`), review the git commit history since the last version bump.
* **Append to RELEASE_NOTES.md**: Write the new release notes directly to the top of `RELEASE_NOTES.md`.
* **Length limit**: Each version entry MUST be kept concise and explicitly limited to a maximum of **500 characters** per entry.
* **Formatting**: Use sentence case for bullet points. Group changes into bolded categories (e.g., `* **Counters:** Added ...`).

