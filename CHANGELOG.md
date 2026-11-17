# Changelog

Alle Versionen der App, die neueste oben.

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
