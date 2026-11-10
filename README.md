# FitTrack

A mobile-first fitness tracker web app (PWA). Add it to your phone's home screen and it runs full-screen like a native app, and works offline.

## Features

- **Strength workouts**: log exercises with sets, reps and weight. "Last time" hints and pre-filled sets from your previous session. Rest timer after each set. Repeat past workouts in one tap. PR detection when you finish.
- **Cardio**: run, walk, cycle, swim, row, hike, elliptical and more, with duration, distance, calories, notes and auto pace/speed.
- **Body weight**: daily weigh-ins with a trend chart and 30-day change.
- **Calendar**: month overview with a dot per session; tap a day to see what you did and when. Filter by muscle group.
- **Edit & backfill**: edit any finished workout or cardio entry, or log a past workout you forgot, with an optional time.
- **Exercise library**: built-in exercises tagged by muscle group (chest, back, shoulders, biceps, abs, legs, hamstrings…), plus your own exercises and tags. Listed A–Z with tag filters. Manage it in Settings.
- **Goals & streaks**: weekly workout goal ring, week-by-week streak, best streak, and a week-at-a-glance strip.
- **Progress**: estimated 1RM chart and PRs per exercise, monthly cardio totals, all-time stats.
- **Settings**: kg/lb and km/mi (converts existing data), weekly goal, rest timer length, backup export/import.

Data is always saved on the device (so the app works offline). With **cloud sync** set up, it also syncs between your devices: log on your phone, see it on your laptop.

## Cloud sync (Firebase)

Sync uses Firebase Auth (email + password) and one Firestore document per user. Each device keeps its own copy and merges with the cloud whenever either side changes, so offline edits on two devices merge instead of overwriting each other, and deletions carry over.

One-time setup (free Spark plan, no credit card):

1. Go to https://console.firebase.google.com → **Create a project** (e.g. `gainer`). Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** → pick a location near you → **Start in production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the following, then **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **Project settings** (gear icon) → **Your apps** → web icon `</>` → register an app (no Hosting needed) → copy the `firebaseConfig = { ... }` object into [`firebase-config.js`](firebase-config.js), then commit and push.
6. Open the app → **Settings → Cloud sync → Create account** on one device, then **Sign in** with the same email and password on your other devices.
7. Optional: so nobody else can sign up to your project, go to **Authentication → Settings → User actions** and untick **Enable create (sign-up)** once your account exists.

The config values aren't secret. Your data is protected by sign-in plus the rules above, which only let each account read and write its own document.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and bottom navigation |
| `app.js` | All app logic, views and storage |
| `styles.css` | Mobile-first styling (light and dark mode) |
| `manifest.webmanifest`, `icons/` | Home-screen install metadata and icons |
| `sw.js` | Service worker for offline use |
| `sync.js`, `firebase-config.js` | Cloud sync between devices (optional) |

No build step and no dependencies.

## Run locally

```bash
cd "/Users/liamn/fitness tracker" && python3 -m http.server 8000
```

Then open http://localhost:8000.

### Quick test on your phone (same Wi-Fi)

With the server running, open `http://<your-mac-ip>:8000` on your phone (find the IP with `ipconfig getifaddr en0`). Offline mode needs HTTPS, so it is off here. Data saved at this address **does not** carry over to the hosted version. Use Export/Import to move it.

## Put it on your phone for real (free hosting)

Pick one:

- **Netlify Drop** (easiest): go to https://app.netlify.com/drop and drag this whole folder onto the page. You get an HTTPS URL.
- **GitHub Pages**: push this folder to a GitHub repo, then go to *Settings → Pages → Deploy from branch → main / root*.

Then on your phone:

- **iPhone (Safari)**: open the URL → Share button → **Add to Home Screen**.
- **Android (Chrome)**: open the URL → ⋮ menu → **Install app** / **Add to Home screen**.

## Updating the app

Edit the files and re-deploy. The service worker fetches fresh files whenever you're online. If you change the list of cached files, bump `CACHE` in `sw.js`.
