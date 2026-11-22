# Security

What is protected, and what isn't:

- **No secrets in the repository.** The Strava keys live only in Netlify's environment variables and are used by the functions; the app never sees them.
- **Passwords** are stored only as a salted PBKDF2-SHA256 hash, never as text.
- **Input is checked** where it comes in: forms (with an error next to the field), imported files (GPX, FIT, TCX, CSV, ZIP) and backup files. Text that comes back from a backup or the cloud sync is cleaned before it is shown (`safeText`, `safeCustom` in `app/exercises.js`), and names are escaped in the HTML.
- **Content-Security-Policy** (`netlify.toml`): the browser runs only our own scripts (no inline scripts), the pinned text recognition, and only connects to the services the app uses. Further headers stop the app from being framed and from sniffing file types.
- **Pinned outside code:** the text recognition is fixed to version 5.1.1 and checked with Subresource Integrity, so a changed file on the CDN is refused. The app itself has no npm dependencies.
- **The functions** only accept calls from the site itself, limit each IP address (Strava 120, news 30 per 10 minutes) and refuse large requests (`netlify/lib/guard.mjs`).

Limits we know about:

- **Data lives on the phone.** Training data is in the browser's storage. “Lock app” hides the app behind the password, but it is not encryption: someone with access to the unlocked phone and the browser's developer tools could read the data. A real fix needs accounts on a server.
- **Signing out** (*Settings › Account › Sign out*) asks for the password, offers a backup first and then removes everything NOVAFit keeps on the phone: the training data, the photos, the Strava login, and the weather and news caches. Keys of other sites are left alone (`appKeys` in `app/plan.js`).
- **The rate limit** is kept in the memory of a function instance: it slows abuse down but resets when Netlify starts a new instance.
- **The Strava tokens** are kept in the browser's storage on the phone (not in backups or the sync), like most web apps do.
