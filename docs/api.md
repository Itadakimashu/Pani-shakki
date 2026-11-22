# API (Django REST Framework)

Base: `https://<your-render-app>.onrender.com/api`. The trailing slash is optional. JSON only.
The in-browser mock (`frontend/src/api/mock.ts`) implements the same shapes.

> Hackathon defaults: the API is open (AllowAny) with anonymous throttling of 120/min. Put `PATCH /reports/{id}`, `/alerts/broadcast` and the admin behind authentication before real use.

## Reports

### `POST /api/reports`
```json
{ "client_id": "uuid-from-device", "union_id": "gabura", "text": "উঠোনে হাঁটু পানি, নৌকা দরকার",
  "lat": 22.2551, "lng": 89.3002, "location_source": "gps", "device_id": "dev-1a2b3c4d",
  "channel": "app", "created_at": "2026-07-10T06:00:00Z", "audio_url": null }
```
`client_id` is the idempotency key. Replaying the same report returns `200` with the existing row, a new one returns `201`. `lat`/`lng` are optional but must be sent together. The server classifies the report and scores trust.

Response (also the shape of every report below):
```json
{ "id": "…", "union_id": "gabura", "text": "…", "audio_url": null, "lat": 22.2551, "lng": 89.3002,
  "location_source": "gps", "device_id": "…", "channel": "app",
  "severity": 2, "water_level": {"label": "knee", "feet": 1.5, "source": "body"},
  "needs": ["boat"], "signals": ["yard_water", "level_knee"], "confidence": 1,
  "trust_score": 1.0, "trust_flags": [], "status": "open",
  "created_at": "…", "responded_at": null, "is_demo": false }
```

### `GET /api/reports`
Query: `union`, `min_severity` (0–3), `severity` (exact), `since_hours`, `status` (`open`|`responded`), `device_id`, `limit` (≤ 2000). Newest first.

### `PATCH /api/reports/{id}`
`{"status": "responded"}` or `{"status": "open"}`. Sets or clears `responded_at`.

## Forecasts & alerts

### `GET /api/forecasts[?union=]`
```json
[{ "station": {"id":"chilmari","river_bn":"ব্রহ্মপুত্র","danger_m":23.7,…},
   "current_m": 23.86, "danger_m": 23.7, "delta_24h_m": 0.26, "delta_48h_m": 0.05,
   "peak_m": 24.12, "peak_at": "…Z", "trend": "rising", "source": "mock",
   "readings": [{"timestamp":"…Z","level_m":23.5,"is_forecast":false}, … 25 items, −24h…+48h every 3h] }]
```

### `GET /api/alerts?union=<id>` (union required)
```json
[{ "id":"alert-ashtamir_char-…","union_id":"ashtamir_char","station_id":"chilmari","level":3,
   "title_bn":"বিপদ! এখনই ব্যবস্থা নিন","title_en":"Danger — act now",
   "text_bn":"আগামীকাল সকালের মধ্যে পানি প্রায় ১ ফুট বাড়তে পারে। ব্রহ্মপুত্র নদীর পানি বিপদসীমার উপরে। …",
   "text_en":"Water may rise about 1 foot by tomorrow morning. …",
   "valid_from":"…","valid_until":"…","created_at":"…","source":"mock" }]
```
Levels: 0 normal, 1 watch, 2 warning, 3 danger.

### `POST /api/alerts/broadcast`
`{"union":"gabura","phones":["+8801…"],"channels":["sms","ivr"]}`. Sends the current alert through the configured adapters and returns delivery results.

## Shelters, unions, stations, dashboard
- `GET /api/shelters/nearest?lat=&lng=[&limit=3]` returns shelters sorted by distance, each with `distance_km`.
- `GET /api/shelters`, `GET /api/unions` (with `station_id`), `GET /api/stations`.
- `GET /api/dashboard/summary` returns `{total, open, responded, emergencies, flagged, by_severity, by_union[], needs{}, stations_above_danger, generated_at}`.
- `GET /api/health` returns `{"ok": true}`.

## SMS / IVR adapters (stubbed)

`core/messaging.py` defines two interfaces. Choose the implementation with an env var holding a dotted path:

| Setting | Default | Interface |
|---|---|---|
| `SMS_ADAPTER` | `core.messaging.ConsoleSMSAdapter` | `send(to, text) -> DeliveryResult`, `parse_inbound(payload) -> {from, text}` |
| `IVR_ADAPTER` | `core.messaging.ConsoleIVRAdapter` | `call(to, text_bn, audio_url=None) -> DeliveryResult`, `parse_inbound(payload) -> {from, text, audio_url}` |

The console implementations log to stdout and keep an in-memory `outbox` (used by the tests). To go live, subclass the interface for your SMS gateway or IVR provider and set the env var.

### Inbound webhooks
- `POST /api/inbound/sms` with `{"union":"gabura","payload":{"from":"+880…","text":"উঠোনে হাঁটু পানি","id":"provider-msg-id"}}`
- `POST /api/inbound/ivr` with `{"union":"gabura","payload":{"from":"+880…","transcript":"আটকা পড়েছি","recording_url":"https://…"}}`

Each creates a report with `channel` = `sms`/`ivr` and `device_id` = `sms:<number>`, so classification, trust and the dashboard treat it the same as an app report. Production would map a shortcode or keyword to the union, and verify the provider's signature.

## Forecast source

`FORECAST_SOURCE` (default `core.forecast_sources.MockForecastSource`). `FFWCForecastSource` is a stub where FFWC observed and forecast levels plug in. `python manage.py refresh_forecasts` pulls and stores readings (run it on a schedule).

## Management commands
- `seed_demo [--if-empty]` loads the shared demo data (`core/fixtures/seed.json`).
- `refresh_forecasts`
