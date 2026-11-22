# Architecture

NOVAFit is a Progressive Web App in plain HTML, CSS and JavaScript, with no framework and no build step. The browser loads `app/index.html`, which pulls in the scripts below in order.

## How it fits together

- **Logic modules** (`plan.js`, `exercises.js`, `run.js`, `yoga.js`, `muscles.js`, `progress.js`, `tour.js`) are pure functions without any access to the page. In the browser they are global objects (`NFPlan`, `NFEx`, `NFRun`, `NFYoga`, `NFMuscles`, `NFProg`, `NFTour`); in Node the tests load them with `require`.
- **`app.js`** holds the app state `S`, draws every screen as HTML and handles every tap through one click handler (`data-act` attributes). There are no inline scripts, so the Content-Security-Policy can forbid them.
- **`guide.js`** is the guided tour on top of the real screens.
- **Languages:** the code is written in English. `i18n.js` translates what is drawn on the page (a `MutationObserver` on the body), using the table in `i18n-data.js` (one row per text: English, Portuguese, German, Italian). Numbers become `{0}`, `{1}`; exercise names, workout names and the user's name become `{a}`, `{b}` and stay as they are; months and weekdays become `{a}`, `{b}` and are translated. A text without a row stays English. Voice cues, toasts and story images go through `T()` directly.
- **Storage:** everything lives in the browser's `localStorage` under `po-plan-app-v2`: profile, settings, plan, history and badges. Own photos are in IndexedDB. Data from storage or a backup is cleaned in `normalize()` before it is used.
- **Offline:** the service worker `OneSignalSDKWorker.js` caches the app files (bump `CACHE` when they change) and receives push reminders.
- **Server side:** three Netlify Functions do what the phone can't do safely: Strava (keeps the client secret), the running loop (keeps the routing key) and the news feed. Each one checks the caller and the request size and limits requests per IP (`netlify/lib/guard.mjs`).

## Files

| Path | Content |
|---|---|
| `app/index.html` | The page: layout and the whole design (CSS) |
| `app/app.js` | The app: state, screens, sessions, storage, reviews, Progress, settings |
| `app/plan.js` | Sign-up validation, questionnaire checks, strength splits, plan suggestions, which sports are on Train, the chapters of the weekly review |
| `app/exercises.js` | Exercise library (124 exercises), workout templates, search, alternatives, checks for custom exercises |
| `app/run.js` | Running: reading runs from screenshots and from GPX, TCX, FIT and Polar Flow CSV files, importing histories from Garmin and Strava, routes |
| `app/yoga.js` | Yoga sessions, timing, which session to suggest, tension and flexibility checks |
| `app/muscles.js` | Which muscles were trained and how much |
| `app/progress.js` | Progress cards per sport, small chart calculations, special Nova badges |
| `app/tour.js` | Example data for the guided tour |
| `app/guide.js` | The guided tour |
| `app/i18n.js`, `app/i18n-data.js` | Languages: the translation layer and the table of texts |
| `app/OneSignalSDKWorker.js` | Service worker: offline use and push reminders |
| `app/manifest.webmanifest`, icons | Name, colours and icon for the home screen |
| `app/img/ex/` | Exercise drawings (CC BY-SA 4.0, see `SOURCES.md`) |
| `app/img/pack/` | Nova photo pack for Today, Train and the reviews |
| `netlify/functions/strava.mjs` | Strava sign-in and runs (keeps the client secret) |
| `netlify/functions/route.mjs` | A running loop from where you are (keeps the openrouteservice key) |
| `netlify/functions/news.mjs`, `netlify/lib/news.mjs` | Nova SBE news headlines |
| `netlify/lib/guard.mjs` | Protection shared by the functions |
| `netlify.toml` | What Netlify publishes, the functions and the security headers |

## Tests

`node --test` runs the unit tests in `tests/`, one file per area:

| File | Covers |
|---|---|
| `plan.test.js` | Sign-up, body data, questionnaire limits, plan suggestions |
| `exercises.test.js`, `build-workout.test.js`, `carry-sets.test.js` | Library, templates, custom exercises, own workouts, sets carried to the next set |
| `run.test.js`, `run-files.test.js`, `history.test.js`, `strava.test.js`, `nearby.test.js` | Screenshots, GPX/TCX/FIT/ZIP, Garmin and Strava imports, the Strava connection, routes |
| `yoga.test.js` | Sessions, suggestions, tension and flexibility checks |
| `muscles.test.js`, `progress.test.js`, `review-plan.test.js`, `train-sports.test.js` | Muscle load, Progress cards and badges, review chapters, sports on Train |
| `tour.test.js` | Example data for the guided tour |
| `guard.test.js`, `news.test.js`, `service-worker.test.js` | Function protection, news parsing, the service worker file |

`npm run e2e` runs the browser tests in `e2e/` with Playwright: the app is served with the same security headers as on Netlify, the browser is kept offline, and any page error or blocked request fails the test. They cover sign-up and the app lock, strength sessions, runs and run files, yoga and the flexibility check, imports and backups, and the whole guided tour.
