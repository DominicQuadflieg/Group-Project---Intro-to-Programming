# Group Project - Intro to Programming

Group project for Introduction to Programming at NOVA.

## Team

- Tassilo Mylius
- Dominic Quadflieg
- Julius Veith

## The app: NOVAFit

A training app for your phone (Progressive Web App) in the design of Nova SBE: strength (lower body, upper body), running and yoga, with personal training plans, progress, stats, a calendar, badges and reminders.

On first start, new users create an account (name, email, password) and answer a short questionnaire:

1. About you: sex, age and body weight (the weight is used to estimate calories)
2. How many sessions per week (2–6)
3. How to split them across strength, running and yoga
4. Predefined goals, up to 2 per type and 6 in total (e.g. “10 km under 60 minutes”, “Your first pull-up”, “Exam-week stress relief”)
5. Level and time per session

NOVAFit then suggests three plans (balanced, focused on the main goal, easy start). The chosen plan sets the weekly goal and shows the next session on the home screen.

A session that has been started can be reset at any time (Reset → Start over or Delete session).

The account is a local profile: it lives on the phone together with the training data. The password is never stored in plain text, only as a salted PBKDF2-SHA256 hash, and locks the app on that device (Settings → Lock app).

## Files

The app needs no build step:

| File | Content |
|---|---|
| `app/index.html` | The app: layout, design (CSS) and logic (JavaScript) |
| `app/plan.js` | Sign-up validation, questionnaire checks and plan suggestions (pure functions, tested) |
| `app/manifest.webmanifest` | Name, colours and icon for the home screen |
| `app/OneSignalSDKWorker.js` | Service worker: offline use and push reminders |
| `app/img/` | Pictures for the home screen and training cards (placeholders) |
| `app/icon-*.png`, `app/apple-touch-icon.png` | App icons |
| `app/INSTALL.txt` | How to install the app on a phone |
| `tests/plan.test.js` | Tests for `app/plan.js` |

## Run

- **Locally:** `python3 -m http.server 8000 --directory app`, then open http://localhost:8000 (opening `app/index.html` directly also works in most browsers).
- **On a phone:** drag the `app` folder onto https://app.netlify.com/drop, open the address on the phone and choose “Add to Home Screen” (details in `app/INSTALL.txt`).

## Test

Requires Node.js 18 or newer, no packages to install:

```
node --test
```

or `npm test`. The tests cover valid and rejected sign-up input (empty fields, invalid email, weak or too long passwords, markup in names), body data (age and weight limits, non-numeric input), questionnaire limits (days, mix, goals per type, level, session length) and the plan suggestions (session counts, rest days, edge cases). GitHub runs them automatically on every push and pull request.

## Replacing the pictures

The pictures in `app/img/` are placeholder graphics:

| File | Where |
|---|---|
| `campus-1.svg`, `campus-2.svg` | Large photo box at the top of the home screen |
| `gym.svg`, `run.svg`, `yoga.svg` | Picture at the top of the training cards |

To use your own photos (ideally JPG, campus photos in portrait, about 1200 px wide):

1. Put the photos into `app/img/`, e.g. `campus-1.jpg`.
2. In `app/index.html`, update the `CAMPUS_PHOTOS` list or the file names in `.simg-gym`, `.simg-run`, `.simg-yoga`.
3. In `app/OneSignalSDKWorker.js`, add the file names to `FILES` and increase `CACHE` by one so installed apps load the new pictures.

Only use your own photos or photos with a suitable licence – pictures from the Nova website are protected by copyright.

## Tracking changes

Every change is saved as its own commit with a short description. Versions are listed in [`CHANGELOG.md`](CHANGELOG.md); the exact code changes are under “Commits” on GitHub.
