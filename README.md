# FitTrack

A mobile-first fitness tracker web app (PWA). Add it to your phone's home screen and it runs full-screen like a native app, and works offline.

## Features

- **Strength workouts**: log exercises with sets, reps and weight. "Last time" hints and pre-filled sets from your previous session. Rest timer after each set. Repeat past workouts in one tap. PR detection when you finish.
- **Cardio**: run, walk, cycle, swim, row, hike, elliptical and more, with duration, distance, calories, notes and auto pace/speed.
- **Body weight**: daily weigh-ins with a trend chart and 30-day change.
- **Goals & streaks**: weekly workout goal ring, week-by-week streak, best streak, and a week-at-a-glance strip.
- **Progress**: estimated 1RM chart and PRs per exercise, monthly cardio totals, all-time stats.
- **Settings**: kg/lb and km/mi (converts existing data), weekly goal, rest timer length, backup export/import.

All data is stored **on your phone only** (browser `localStorage`). Use *Settings → Export backup* now and then.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and bottom navigation |
| `app.js` | All app logic, views and storage |
| `styles.css` | Mobile-first styling (light and dark mode) |
| `manifest.webmanifest`, `icons/` | Home-screen install metadata and icons |
| `sw.js` | Service worker for offline use |

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
