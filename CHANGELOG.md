# Changelog

Alle Versionen der App, die neueste oben.

## Unreleased – Screen stays on, sound when rest is over

- The screen stays on from Start to Finish of every workout, not only in the warm-up and yoga timers; it comes back on after switching apps
- When the rest is over, a short double tone plays on every phone (iPhones can't vibrate from a web app), plus vibration on Android, and the next open set scrolls into view
- New switch in Settings: “Sound when rest is over” (on by default). On an iPhone set to silent the tone stays off

## Unreleased – New app icon

- New home screen icon: the white NOVA ring with its bar on Nova blue (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`); the design keeps to the safe area, so Android's round and squircle masks don't cut it
- Service worker cache bumped so installed apps pick up the new icon

## Unreleased – Own OneSignal app for NOVAFit

- Push notifications now go through NOVAFit's own OneSignal app instead of the one the app was copied from, so NOVAFit users only get NOVAFit messages

## v2.8.2 – Only exercises with a drawing

- 22 exercises without a drawing were taken out of the library (e.g. Turkish Get-up, Olympic lifts, Box Jump, Sit-up); 124 exercises remain, all with drawings
- Swap only suggests exercises with a drawing; all workout templates already use them only
- Older sessions keep the names and progress curves of the removed exercises, and they can be added again as your own exercise
- 2 new tests (90 in total)

## v2.8.1 – Drawings for 124 exercises

- 52 more exercises have drawings, from Workout Guide by Bryl Lim (based on Everkinetic, CC BY-SA 4.0): e.g. Hip Thrust, Plank, Overhead Press, Lat Pulldown, Bulgarian Split Squat, Kettlebell Swing, Face Pull and all cardio machines
- The how-to sheet shows one to three numbered frames; the credit names the source of each drawing
- Drawings are now numbered files (`<id>-1.svg`, `<id>-2.svg`, …); `app/img/ex/SOURCES.md` lists the source and frames of every drawing
- Test checks every frame, caption and credit (88 tests)

## v2.8 – Exercise library, splits and mobility

- Exercise library with 146 exercises named like in the Strong app (“Bench Press (Barbell)”, “Lat Pulldown (Cable)”), searchable and filtered by body part and equipment; tap one to see how it's done and which muscles it trains
- Four ways to log a set: weight × reps, reps only (bodyweight), assisted (kg of help, less is better) and time (seconds, minutes for cardio)
- Your own exercises: name, body part, equipment and log type, checked for missing fields, length, markup and duplicates
- In a session: “+ Add exercise” from the library, “✕ Remove” for any exercise (asks first if sets are already checked off), “Swap” now offers every exercise with the same movement
- New workout templates: Full Body A/B/C, Upper Body A/B, Lower Body A/B, Push, Pull, Legs and an empty session; Upper Body and Lower Body were updated to match
- New questionnaire step “How do you want to split your strength days?”: three or four options for every number of strength sessions (e.g. for 3: 3× Full Body, Push/Pull/Legs, 2× Upper + 1× Lower, 1× Upper + 2× Lower), the best match for your goal and level is marked
- The week combines the split with running and yoga: no run the day after a heavy leg session where possible, and each session suggests a short mobility routine afterwards (hip mobility, shoulder mobility, full-body stretch, runner's stretch)
- Three new mobility routines; the cool-down shows up after a session, in the plan and in the yoga menu
- Home screen: start buttons follow your split, “More workouts” and the exercise library; tap a day in the plan to see that session
- Drawings of the start and end position for 72 exercises from Everkinetic (CC BY-SA 4.0), shown with numbered captions on the how-to sheet; step-by-step instructions for bench press, deadlift, pull-up, seated row and leg press
- Older sessions keep their exercise names and progress curves
- 22 new tests for the library, custom exercises, splits and the week schedule (87 in total)

## v2.7 – Strava: runs from your watch come in by themselves

- New “Connect Strava” in the run menu and in Settings. Runs from Garmin, Polar, Coros, Suunto and Apple Watch that reach Strava are added automatically when NOVAFit is opened (can be turned off)
- “Get runs from Strava” shows new runs from the last 30 days to pick from; treadmill runs and the Alster loop are recognised, own run titles become the note
- No double counting: runs that are already imported or were logged by hand the same day are skipped; rides and other sports are left out
- The Strava secret stays on the server in a Netlify Function (`netlify/functions/strava.mjs`); the app only gets read access; the login stays on the phone and is not part of backups or the cloud sync; “Disconnect Strava” removes the access
- New `netlify.toml` and setup steps in the README; without the setup the app looks and works as before
- 11 new tests for the Strava logic and the function (65 in total)

## v2.6 – Import runs from your watch

- New “Import from your watch” button when logging an outdoor run: choose a GPX, FIT or TCX file, also the ZIP from Garmin Connect (“Export Original”) or a .gz file
- Works for Garmin, Strava, Polar, Coros, Suunto, Wahoo and Apple Watch (via an export app); “How do I get the file?” explains the export for each
- Exact values instead of text recognition: distance, moving time (pauses at traffic lights don't count) and start time; everything runs on the phone, no account or internet needed
- Same “Is this right?” step as for screenshots; rides, swims and other sports are refused with a clear message
- Warning when the run is already saved, so it isn't counted twice (also for screenshots)
- 13 new tests with example GPX, TCX, FIT and ZIP files (54 in total)

## v2.5 – Run screenshots: more reliable and with a check

- Reading run screenshots works with many more layouts: Strava (distance, pace and time in one row), Garmin, Apple Fitness and Nike, labels in English and German, whole kilometres (“10 km”), miles, distances without a unit under their label
- The clock in the status bar is no longer taken as the running time; typical reading errors (O for 0, l for 1) are fixed; a misread distance is corrected from pace and time
- Dates in more formats: 17.11.2026, 2026-11-17, 11/17/2026, “Nov 17, 2026 at 7:12 AM”, “Yesterday”
- New “Is this right?” step after reading: the screenshot next to distance, time and date, all editable and checked with clear errors, before anything is saved
- Clear messages for each problem (not an image, image can't be opened, offline, nothing found) instead of always “needs internet”
- The text recognition starts loading as soon as “Upload screenshot” is tapped and shows its progress; after the first time it is kept for offline use, also across app updates
- New file `app/run.js` with the running logic and 20 new tests (41 in total)

## v2.4 – Goals per type, body data, lower body, reset

- Goals: up to 6 in total and at most 2 per type (strength, running, yoga); the counter per type shows how many are picked
- New first questionnaire step “A bit about you”: sex, age (16–99) and body weight (30–250 kg, decimal comma or point), checked with clear errors; the weight is used for the calorie estimate, everything is shown in Settings → Account
- “Glute Day” is now **Lower Body**: back squats, Romanian deadlift, Bulgarian split squats and hip thrusts, optional lying leg curls, standing calf raises and hip adduction; new alternatives (leg press, goblet squats, Smith machine squats, seated leg curls), guides with drawings, new warm-up (bodyweight squats, walking lunges)
- Older sessions keep their history; kickbacks stay available for old records; saved plans are renamed automatically
- Every running session (strength, run, yoga) has **Reset** at the top right: “Start over” clears everything logged and restarts the clock, “Delete session” removes it completely
- Tests extended to 21 (body data, goal limits, lower body)

## v2.3 – English, account and personal plans

- The whole app is now in English: all screens, workouts, yoga flows, exercise guides, badges, reviews, share images, calendar files and notification settings; dates and numbers in English format
- New first start: welcome screen, then create an account with name, email and password (checked for valid input with clear error messages)
- The password is stored only as a salted PBKDF2-SHA256 hash, never in plain text; “Lock app” in Settings locks NOVAFit until the password is entered (after 5 wrong tries there is a 30-second pause); password can be changed
- Questionnaire in four steps: sessions per week, split across strength/running/yoga, up to three predefined goals (running, strength, yoga and mobility), level and time per session
- NOVAFit suggests three plans (balanced week, goal-focused “best match”, easy start); the chosen plan sets the weekly goal
- Home screen: new plan card with the week, today's or the next session and a start button; the hero box and reminders follow the plan's training days
- Existing users keep all their training data: they create an account once and can skip the questionnaire
- “I already have an account” loads a backup file on a new phone
- New file `app/plan.js` with the logic for validation and plans, plus 19 automated tests (`node --test`), run by GitHub on every push and pull request
- `LIESMICH.txt` is now `INSTALL.txt` (in English)

## v2.2 – Nova-Design: Fotos, Bilder-Karten, Farbblöcke, Menü

- Großer Kasten oben zeigt Campus-Fotos statt Schwarz (wechseln alle 10 s, Pfeile ‹ › zum Blättern). Eigene Fotos aus den Einstellungen haben Vorrang
- Trainingskarten mit Bild oben (je nach Art: Gym, Laufen, Yoga) und Rahmen-Button „Starten“
- „Stärker geworden“ als lila Block, „Laufen“ als Nova-blauer Block mit weißen Zahlen und Linien-Icons auf Balken
- Hamburger-Menü statt Zahnrad und Mond: Einstellungen, Laufplan, Kalender, Abzeichen, Sicherung, Dunkelmodus
- Schwarzer Footer am Ende der Startseite mit Schnellzugriffen
- „Wochenrückblick“ als Rahmen-Button, „Nach oben“ am rechten Rand (Tablet/Desktop)
- Abschnitte blenden beim ersten Öffnen sanft ein (nicht bei „Bewegung reduzieren“)
- Bilder liegen in `app/img/` – aktuell Platzhalter, siehe README
- Wortmarke: „Fit“ jetzt dünn, das schwebende O in Nova-Blau (im Header und im Footer)

## v2.1 – Neuer NOVAFit-Header

- Neue Wortmarke im Header: N – schwarzer Balken mit schwebendem O – VAFit (als Vektorgrafik, schwarz auf weiß)
- Ganz oben groß aufgefaltet; beim Scrollen ziehen sich Headerhöhe, Balkenbreite und Position des O fließend zusammen, danach bleibt eine schmale Leiste oben haften
- Die Bewegung hängt direkt an der Scrollposition und entfaltet sich erst am Seitenanfang wieder vollständig
- Die Trainingsoberfläche verrutscht beim Übergang nicht (Header hat immer dieselbe Höhe)
- Dunkelmodus- und Einstellungen-Button bleiben jederzeit erreichbar
- Eigene Größen für Smartphone, Tablet, Desktop und Handy quer; bei „Bewegung reduzieren“ bleibt der Header kompakt ohne Animation

## v2.0 – NOVAFit (Redesign im Nova-Design)

- App umbenannt von „My Workout“ in **NOVAFit** (Seite, Home-Bildschirm, Teilen-Bilder, Rückblicke, Kalender, Sicherungsdateien)
- Design an die Website der Nova SBE angepasst:
  - Überschriften in *Playfair Display*, Text in *Open Sans*
  - Schwarz-Weiß, eckige Formen, schwarzer Balken unter den Abschnittstiteln
  - Farben: Schwarz fürs Gym-Training, Nova-Blau `#005BAA` fürs Laufen, Nova-Orange `#FC4C01` für Yoga, Nova-Rot `#ED1B34` als Akzent
- Neues App-Symbol: weißes „N“ auf Schwarz mit rotem Balken
- Timer, Zusammenfassung, Teilen-Bild, Jahresrückblick und Dunkelmodus im neuen Design
- Offline-Speicher (Service Worker) neu benannt, damit installierte Apps das Update laden
- Gespeicherte Trainingsdaten bleiben beim Update erhalten
