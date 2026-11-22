# AGENTS.md

Notes for coding agents (and new team members) working on NOVAFit.

## Stack

- Plain HTML, CSS and JavaScript, no framework and no build step
- `app/index.html` is the page (layout, CSS) and `app/app.js` the app itself (no inline scripts: the Content-Security-Policy in `netlify.toml` forbids them); `app/plan.js` holds the testable logic for sign-up, questionnaire, splits and plans; `app/exercises.js` the exercise library, workout templates and custom-exercise checks (exercise ids are stored in the history, never rename or remove one); `app/run.js` the testable running logic (screenshots, GPX/TCX/FIT files, importing a training history from Garmin and Strava); `app/yoga.js` the yoga sessions, their timing, which one to suggest (time of day and the yoga goals) and the flexibility check (`S.settings.flex`); `app/progress.js` the Progress cards per sport (`S.settings.pcards`), small chart calculations and the special Nova badges; `app/tour.js` the example data for the guided tour; `app/guide.js` the guided tour itself (starts once after sign-up, Menu › Guided tour; a sandbox: everything is saved before it starts and put back at the end, see `nf-guide-snap`)
- Data is stored in `localStorage` under the key `po-plan-app-v2` (do not rename it, or existing users lose their data)
- Strava connection: `netlify/functions/strava.mjs` (Netlify Function, needs `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` set in Netlify, never in the repo); Strava tokens live only in `localStorage` under `novafit-strava`, never in `S`
- Runs near you: hand-picked routes in `app/run.js` (`NEARBY_ROUTES`, at most 4, so with the loop there are never more than 5 suggestions); the loop from here comes from `netlify/functions/route.mjs` (openrouteservice, needs `ORS_API_KEY` in Netlify); the exact position is only sent for that one request and never stored
- Service worker and push reminders: `app/OneSignalSDKWorker.js` (bump `CACHE` when files change)
- Tests: Node.js built-in test runner; the browser tests use Playwright (the only package, a pinned dev dependency)

## Commands

- Run locally: `python3 -m http.server 8000 --directory app`, then open http://localhost:8000
- Run tests: `node --test` (or `npm test`)
- Browser tests: `npm ci`, `npx playwright install chromium`, `npm run e2e` (files in `e2e/`, sample files in `e2e/fixtures/`)

## Conventions

- The app UI is written in English and shown in English, Portuguese, German or Italian (`app/i18n.js`, table in `app/i18n-data.js`): a new on-screen text needs a row there with all three translations (numbers as `{0}`, exercise names and months as `{a}`; `tests/i18n.test.js` checks the placeholders), otherwise it simply stays English
- Keep logic that can be tested in `app/plan.js`, `app/exercises.js`, `app/run.js`, `app/yoga.js`, `app/progress.js` or `app/tour.js` as pure functions and add tests in `tests/`
- Validate all user input and show a clear error next to the field
- Never store passwords or other secrets in plain text or in the repository
- Escape user text with `esc()` before it goes into HTML; clean text that comes from storage or backups in `normalize()`
- A new outside service needs its host in the Content-Security-Policy in `netlify.toml`; outside scripts get a pinned version (and SRI where the file is fixed)
- Netlify Functions use `guard()` from `netlify/lib/guard.mjs`
- One change per commit and pull request, with a short description; update `CHANGELOG.md`
