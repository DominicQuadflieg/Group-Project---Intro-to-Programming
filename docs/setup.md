# Setup

How to run NOVAFit with everything switched on. For a quick start see the [README](../README.md).

## Netlify (hosting and server functions)

1. On Netlify, *Add new site › Import an existing project › GitHub* and pick this repository. `netlify.toml` already says what to publish (`app`) and where the functions are (`netlify/functions`). Every merge into `main` then deploys automatically.
2. Add the keys below under *Site configuration › Environment variables* and deploy again. Without them the app still works; the parts that need them stay hidden or say “Needs a one-time setup”.

| Variable | For | Where to get it |
|---|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava connection | https://www.strava.com/settings/api |
| `ORS_API_KEY` | A running loop from where you are | https://account.heigit.org (free Basic Key) |

The keys never go into the repository: only the functions in `netlify/functions/` use them.

## Strava connection

> **Not switched on in our live version.** Using the Strava API needs a Strava subscription, and none of us has one. So the live NOVAFit runs without the two Strava keys, and the “Connect Strava” button doesn't show. Nothing else depends on it: runs still come in by **screenshot**, by **watch file** (GPX, FIT, TCX, also the ZIP from Garmin Connect) and through **Bring your training history** with the Garmin list or the **Strava archive**, which every Strava account can download for free.
>
> The connection itself is complete: the function `netlify/functions/strava.mjs`, the sign-in and the import in the app. It is checked by tests that replace Strava with a fake (`tests/strava.test.js`). With a subscription, the steps below switch it on, and nothing in the code has to change.

Garmin, Polar, Coros, Suunto and Apple Watch can send runs to Strava automatically. Connected to Strava, NOVAFit picks up those runs whenever the app is opened.

Strava gives each app a public client ID and a secret. The secret must never be in the app or in this repository, so a small Netlify Function (`netlify/functions/strava.mjs`) talks to Strava for the app.

One-time setup:

1. **Connect Netlify to GitHub:** on Netlify, *Add new site → Import an existing project → GitHub* and pick this repository. `netlify.toml` already says what to publish (`app`) and where the function is. Every merge into `main` then deploys automatically.
2. **Create a Strava API app:** https://www.strava.com/settings/api. Use the site address as *Website* and its domain (e.g. `novafit.netlify.app`, without `https://`) as *Authorization Callback Domain*.
3. **Add the keys to Netlify:** *Site configuration → Environment variables*: `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` from the Strava page, then deploy again.
4. Open the app: *Run → Connect Strava*. The Strava button only shows up once the function answers, so the app looks as before without this setup.

Notes:

- **Optional, and limited:** a new Strava API app starts in “Single Player Mode”: only the athlete who created it can connect. It can be raised to 10 athletes in the API settings (this needs a Strava subscription); more needs a review by Strava that can take weeks. Without the two keys the “Connect Strava” button simply doesn't show, and everyone can still bring their runs by screenshot, watch file or the Strava archive.
- NOVAFit only asks for read access to activities. The login stays on the phone under its own storage key, so it isn't part of backups or the cloud sync. *Settings → Strava → Disconnect* removes it and the access on Strava.
- Strava allows 200 requests per 15 minutes and 2,000 per day per app. NOVAFit checks at most every 15 minutes per phone.

## Bring your training history

New users can bring their runs from other apps right after choosing a plan (“Bring your training history”), and everyone can do it later under *Settings → Your data → Import runs from other apps*:

| Source | What to choose | How to get it |
|---|---|---|
| Garmin Connect | the activity list (CSV) | connect.garmin.com → *Activities → All Activities* → scroll until the year is loaded → *Export CSV* |
| Strava | the archive (ZIP) or `activities.csv` from it | strava.com → *Settings → My Account → Download or Delete Your Account → Request Your Archive* |
| Strava (connected) | nothing, NOVAFit gets the runs since 1 January | needs the Strava connection above (not switched on in our live version) |
| Polar, Coros, Suunto, Apple Watch … | several GPX, FIT or TCX files at once | export from the app of the watch |

A preview shows the number of runs and kilometres, with the time range (this year, last 12 months, everything), walks on or off, and kilometres or miles for Garmin files. Rides and other sports are left out, runs that are already in NOVAFit are skipped, and an import can be undone right away. Everything is read on the phone; big Strava archives are not loaded completely, only the activity list inside.

## Runs near you

*Train › Running › Runs near you* suggests at most five runs (`NEARBY_ROUTES` in `app/run.js`, `netlify/functions/route.mjs`). The entry was taken out of the running menu in #39 and is back as its own row, in the menu's design:

- **Up to 4 hand-picked routes** (`NEARBY_ROUTES` in `app/run.js`): Carcavelos seafront, Oeiras seafront, Paredão Estoril–Cascais and the Lisbon riverside at Belém, sorted by how far away they are. The weather location is used for this (rounded to about 1 km, Nova SBE if location is off). Routes that fit the next run of your running plan are marked. Lengths are approximate: it's a demo set, check them before you rely on them.
- **A loop from here:** pick 3, 5, 8 or 10 km (or the length of your next plan run) and NOVAFit makes a round trip on foot paths from where you are, shows its shape and opens it in Google Maps. For this one request the position is sent to the route service, it isn't stored.

“Start this run” opens an outdoor run with the distance and the route already filled in.

The loop needs a free openrouteservice key (the list of routes works without it):

1. Sign up at https://account.heigit.org (openrouteservice now runs there). Open the **API Key** tab and copy the **Basic Key** with the Copy button; it starts with `eyJ`.
2. In Netlify → *Site configuration → Environment variables* add `ORS_API_KEY` with the token, then deploy again (like the Strava keys, it only works when Netlify is connected to this repository).

Without the key the app shows “Needs a one-time setup” instead of the loop button.

## Pictures

**Photo pack (home screen and reviews):** put the photos into `app/img/pack/` with the names listed in `app/img/pack/README.txt`. They are used for the photo box on the home screen and as backgrounds in the weekly and monthly reviews, unless a user has added own photos in Settings. The list and the crop for portrait screens are in `PHOTO_PACK` in `app/index.html`. Missing files are skipped.

**Placeholder graphics:** the pictures in `app/img/` are placeholders:

| File | Where |
|---|---|
| `campus-1.svg`, `campus-2.svg` | Photo box on the home screen, only if the photo pack is empty |
| `gym.svg`, `run.svg`, `yoga.svg` | Picture at the top of the training cards |

To change the training card pictures, update the file names in `.simg-gym`, `.simg-run`, `.simg-yoga` in `app/index.html`. When you add files the app loads at start, also add them to `FILES` in `app/OneSignalSDKWorker.js` and increase `CACHE` by one so installed apps pick them up (photo pack files are cached automatically when they are first shown).

The photos in `app/img/pack/` are © Nova SBE and used only for this course project. For anything beyond the course, replace them with your own photos or photos with a suitable licence.

## Older ready-made download

A snapshot from 17 November (v2.8.2) is kept in the Git history: [download NOVAFit 2.8.2.zip](https://github.com/juveith/Group-Project---Intro-to-Programming/raw/32b7c146c4acaca2b35766e82a0b43dc069e77da/releases/NOVAFit%202.8.2.zip). For the current app use the `app` folder or the live link.
