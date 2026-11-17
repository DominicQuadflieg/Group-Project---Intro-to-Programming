# AGENTS.md

Notes for coding agents (and new team members) working on NOVAFit.

## Stack

- Plain HTML, CSS and JavaScript, no framework and no build step
- `app/index.html` contains the app; `app/plan.js` holds the testable logic for sign-up, questionnaire and plans; `app/run.js` the testable running logic (screenshots, GPX/TCX/FIT files)
- Data is stored in `localStorage` under the key `po-plan-app-v2` (do not rename it, or existing users lose their data)
- Service worker and push reminders: `app/OneSignalSDKWorker.js` (bump `CACHE` when files change)
- Tests: Node.js built-in test runner, no dependencies

## Commands

- Run locally: `python3 -m http.server 8000 --directory app`, then open http://localhost:8000
- Run tests: `node --test` (or `npm test`)

## Conventions

- The app UI is in English
- Keep logic that can be tested in `app/plan.js` or `app/run.js` as pure functions and add tests in `tests/`
- Validate all user input and show a clear error next to the field
- Never store passwords or other secrets in plain text or in the repository
- One change per commit and pull request, with a short description; update `CHANGELOG.md`
