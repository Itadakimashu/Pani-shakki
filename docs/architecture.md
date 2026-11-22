# Architecture

```
 Villager phone (PWA)                         Responder (same PWA, Dashboard tab)
 ┌──────────────────────────────┐            ┌──────────────────────────────┐
 │ Report: Web Speech (bn-BD →  │            │ Leaflet + OSM, markercluster │
 │ bn-IN), typed fallback, GPS, │            │ priority list, filters,      │
 │ union picker                 │            │ shelters, "responded"        │
 │ Alerts: template text + TTS  │            └──────────────┬───────────────┘
 └──────────────┬───────────────┘                           │
                │ submitReport()                            │ api.*
        ┌───────▼────────┐                                  │
        │ Outbox (IDB)   │── flush() when online ──┐        │
        └────────────────┘                         ▼        ▼
                                     ┌───────────── Api interface ─────────────┐
                                     │  mockApi (IndexedDB)  │  httpApi (fetch) │
                                     │  DEMO MODE (default)  │  VITE_API_URL /  │
                                     │  classifier, trust,   │  saved URL       │
                                     │  forecast, alerts run │                  │
                                     │  in the browser       │                  │
                                     └───────────────────────┴────────┬────────┘
                                                                      │ REST JSON
                                            ┌─────────────────────────▼──────────┐
                                            │ Django + DRF (backend/core)        │
                                            │ classifier/ (same rules.json)      │
                                            │ trust.py · alerts.py · geo.py      │
                                            │ forecast_sources.py: Mock | FFWC   │
                                            │ messaging.py: SMS/IVR adapters     │
                                            │ SQLite (dev) / Postgres (prod)     │
                                            └────────────────────────────────────┘
```

## Key decisions

- **Demo mode by default.** GitHub Pages serves static files only, so the whole API is also implemented in the browser (`frontend/src/api/mock.ts`) with the same request and response shapes as Django. Setting `VITE_API_URL`, or saving a URL in the More tab, switches to `httpApi`.
- **One classifier, two runtimes.** `rules.json` holds weighted regex rules, spelling replacements, water-level and need patterns. `classifier.ts` and `classifier.py` are line-for-line ports. The patterns use only syntax that is valid in both JS (`u` flag) and Python `re` (no `\b`, fixed-width lookbehind only). A parity run over every test and seed sentence gave identical output (severity, score, confidence, signals, needs, level).
- **Classifier algorithm.**
  1. Normalise: unify nukta forms (য় ড় ঢ়), strip ZWJ/ZWNJ, convert Bangla digits ০-৯ to ASCII, drop danda and punctuation, apply spelling replacements (পানী→পানি, উঠান→উঠোন, হাটু→হাঁটু, সাহাজ্য→সাহায্য…).
  2. Each rule that matches (and whose `unless` doesn't, e.g. "পানি নেই") adds its weight to its level bucket.
  3. Water level: an explicit measurement (`২ ফুট`, `দেড় হাত`, `সাড়ে তিন ফুট`, `২ মিটার`) wins, otherwise the deepest body reference (ankle…over head). Body depth ≥ chest adds to emergency; knee/waist adds to flooded. A measurement next to a "rising" verb counts as a river rise, not standing water.
  4. Decision: emergency if score₃ ≥ 3, flooded if score₂ + score₃ ≥ 2, rising if the cumulative score ≥ 1 and beats the "normal/receding" score, otherwise normal.
- **Trust scoring** (`trust.ts` / `trust.py`) starts at 1.0 and subtracts for: same device sending ≥ 3 reports in 30 minutes (−0.3); same device repeating the same text within 6 h (−0.35); GPS > 15 km (−0.25) or > 40 km (−0.45) from the claimed union; severity ≥ 2 levels away from the median of ≥ 2 other devices within 5 km and 6 h (−0.25); no GPS (−0.05); very short text (−0.1). It adds +0.1 when nearby reports agree. Reports scoring below 0.5 count as "flagged".
- **Priority**: severity ↓, then recency in 1-hour buckets ↓, then density (other reports within 3 km in 24 h) ↓.
- **Alerts**: `alertLevel()` (danger if above the danger mark and not falling, warning if the forecast peak crosses it, watch if within 0.3 m and rising). Text comes from short templates: time phrase in Dhaka time ("আগামীকাল রাতের মধ্যে"), rise in feet rounded to a half ("প্রায় দেড় ফুট"), then one action per sentence.
- **Forecasts**: `ForecastSource` interface. `MockForecastSource` is a deterministic synthetic hydrograph (riverine rise-peak-fall, or tidal sinusoid). `FFWCForecastSource` is a stub where real FFWC data plugs in. Readings are cached as `ForecastReading` rows per hour.
- **Offline**: Workbox precaches the app shell, fonts and icons. OSM tiles are cached CacheFirst (400 tiles, 14 days). Reports are written to an IndexedDB outbox *before* sending, using the client-generated id as an idempotency key, so a retry never duplicates a report.
- **Performance on slow 3G**: the initial JS is about 108 KB gzipped. Leaflet and the dashboard are lazy-loaded. Only the Bengali and Latin subsets of Noto Sans Bengali (400/700, woff2) are bundled. There are no external runtime requests except map tiles.
- **Accessibility / mobile**: every tap target is ≥ 48 px (checked with Playwright at 360 px wide, no horizontal scroll), Bangla body text is 17–21 px, severity is shown by number and colour together, and `prefers-reduced-motion` is respected.
