# পানি সাক্ষী · Pani Shakkhi ("Water Witness")

A **Bangla voice-first flood alert and reporting system** for char, haor and coastal communities in Bangladesh.

- 🎙️ **Villagers** speak a flood report in Bangla (or type it). GPS is attached automatically. Reports are queued offline and sent when the network returns.
- 🧠 A **Bangla rule-based classifier** grades each report (0 normal · 1 rising · 2 flooded · 3 emergency) and pulls out the water level (হাঁটু/কোমর পানি, "২ ফুট"…) and the needs (food, boat, medicine, livestock…).
- 🔔 **Alerts** in plain Bangla are generated from river forecasts, and the **শুনুন (Listen)** button reads them aloud.
- 🗺️ **Responders** get a map with clustered, colour-coded reports, river stations and shelters, plus a priority list, filters, trust flags for fake or duplicate reports, and a "responded" button.

**Live demo (installable PWA):** https://itadakimashu.github.io/Pani-shakki/

> ⚠️ **All data in the demo is DEMO DATA.** Union names are real but coordinates are approximate. Reports, river levels and shelter figures are invented.

## Demo mode vs live mode

| | Demo mode (default) | Live mode |
|---|---|---|
| When | No backend URL configured | `VITE_API_URL` set at build time, **or** a URL saved in **আরও › Backend URL** |
| Data | IndexedDB in your browser, seeded with 60 reports, 11 unions, 8 stations, 15 shelters | Django + DB (`/backend`) |
| Classifier / trust / alerts | Run in the browser (`frontend/src/lib`) | Run on the server (`backend/core`). Same rules, same tests |
| Offline queue | ✅ | ✅ |

## Repo layout

```
frontend/   React + Vite + TypeScript PWA (HashRouter, Leaflet, vite-plugin-pwa)
backend/    Django + DRF API, Bangla classifier (Python mirror), alerts, adapters
docs/       architecture.md · api.md · demo-script.md
scripts/    generate_seed.py (shared demo data) · sync-shared.sh (copy shared rules)
render.yaml Render Blueprint for the backend
.github/workflows/deploy.yml  build + test + publish to GitHub Pages on push to main
.github/workflows/ci.yml      frontend + backend tests on every push
```

The classifier rules (`frontend/src/lib/classifier/rules.json`) and test cases (`cases.json`) are the **single source of truth**. `scripts/sync-shared.sh` copies them to the backend, and a backend test fails if the two copies drift apart.

## Tests

```bash
cd frontend && npm ci && npm test        # Vitest: classifier (42 Bangla cases), domain logic, mock API
cd backend && pip install -r requirements-dev.txt && pytest   # same 42 cases + API tests
```

## Deploying the frontend (GitHub Pages)

`deploy.yml` runs on every push to `main`. One-time setup:

1. **Settings › Pages › Build and deployment › Source: GitHub Actions.**
2. GitHub Pages on a **private** repo needs a paid plan (Pro/Team/Enterprise). On a free account, make the repo public (Settings › General › Danger Zone › Change visibility) or the site won't publish.
3. Optional: **Settings › Secrets and variables › Actions › Variables › New variable** `VITE_API_URL` = your backend URL, then re-run the workflow (Actions › Deploy… › Run workflow).

## Deploying the backend later (Render free tier, all from a phone)

1. Open https://dashboard.render.com in your phone browser and sign in with GitHub.
2. Tap **New +** › **Blueprint**. Connect your GitHub account if asked and give Render access to the `Pani-shakki` repo.
3. Pick the repo. Render reads `render.yaml` and shows the `pani-shakkhi-api` service. Tap **Apply** / **Deploy Blueprint**.
4. Wait for the build (about 3–5 minutes). Open the service and copy its URL, e.g. `https://pani-shakkhi-api.onrender.com`. Check `…/api/health` shows `{"ok":true}`.
5. Point the app at it, either:
   - **Quick (no rebuild):** open the app › **আরও (More)** › **Backend URL** › paste › **Save**. The header badge changes from **ডেমো** to **লাইভ**.
   - **For everyone:** set the `VITE_API_URL` repo variable (above) and re-run the Pages workflow.

Notes: free Render instances sleep after about 15 minutes idle, so the first request can take around 50 seconds. The default blueprint uses SQLite, which resets on each restart and is re-seeded automatically. For persistent data, uncomment the Postgres block in `render.yaml`. `backend/Dockerfile` is also provided for any Docker host.

## Local development (optional)

```bash
cd frontend && npm ci && npm run dev            # http://localhost:5173/Pani-shakki/
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
python manage.py migrate && python manage.py seed_demo && python manage.py runserver
# then: VITE_API_URL=http://localhost:8000 npm run dev
```

See [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md) and [docs/demo-script.md](docs/demo-script.md).
