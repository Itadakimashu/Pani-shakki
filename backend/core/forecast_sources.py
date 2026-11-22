"""Pluggable forecast sources.

Select with settings.FORECAST_SOURCE (dotted path). A source returns readings
for a station; services.refresh_forecasts() stores them as ForecastReading rows.

* MockForecastSource — deterministic demo model (mirrors frontend/src/lib/forecast.ts).
* FFWCForecastSource — STUB for the Bangladesh Flood Forecasting & Warning Centre (ffwc.gov.bd).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.utils.module_loading import import_string


@dataclass
class Reading:
    timestamp: datetime
    level_m: float
    is_forecast: bool


class ForecastSource:
    name = "base"

    def readings(self, station, now: datetime | None = None) -> list[Reading]:  # pragma: no cover - interface
        raise NotImplementedError


def hour_anchor(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def level_at(m: dict, h: float) -> float:
    if m["kind"] == "tidal":
        w = 2 * math.pi / m["period_h"]
        return m["now_m"] + m["amp"] * (math.sin(w * (h + m["phase_h"])) - math.sin(w * m["phase_h"])) + m["trend"] * h
    if h <= 0:
        return m["now_m"] + m["past_rate"] * h
    if h <= m["peak_h"]:
        return m["now_m"] + m["peak_delta"] * math.sin(math.pi / 2 * (h / m["peak_h"]))
    return m["now_m"] + m["peak_delta"] - m["fall_rate"] * (h - m["peak_h"])


def _r2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


class MockForecastSource(ForecastSource):
    """DEMO: smooth synthetic hydrographs anchored to the current hour."""
    name = "mock"

    def readings(self, station, now=None):
        t0 = hour_anchor(now)
        return [Reading(t0 + timedelta(hours=h), _r2(level_at(station.model, h)), h > 0) for h in range(-24, 49, 3)]


class FFWCForecastSource(ForecastSource):
    """STUB for real FFWC data.

    To implement: fetch observed water levels and the 5-day deterministic forecast
    for `station.ffwc_code` from FFWC (https://www.ffwc.gov.bd/ — check their current
    data-sharing API/terms), convert to metres (PWD datum), and return Reading rows.
    Keep it network-isolated behind this interface so the rest of the app is unchanged.
    """
    name = "ffwc"

    def readings(self, station, now=None):
        raise NotImplementedError("FFWC integration not implemented yet — set FORECAST_SOURCE to the mock source")


def get_source() -> ForecastSource:
    return import_string(settings.FORECAST_SOURCE)()


def summarize(station, readings: list[Reading], now=None) -> dict:
    """Same shape as the frontend StationForecast."""
    t0 = hour_anchor(now)
    by_h = {round((r.timestamp - t0).total_seconds() / 3600): r.level_m for r in readings}
    m = station.model or {}
    if m:  # hourly resolution for the peak when the model is available
        future = [(h, level_at(m, h)) for h in range(0, 49)]
        cur = level_at(m, 0)
        d24, d48 = level_at(m, 24) - cur, level_at(m, 48) - cur
    else:
        future = sorted((h, v) for h, v in by_h.items() if 0 <= h <= 48)
        cur = by_h.get(0, future[0][1] if future else 0)
        d24 = by_h.get(24, cur) - cur
        d48 = by_h.get(48, cur) - cur
    peak_h, peak = 0, -1e9
    for h, v in future:
        if v > peak + 1e-9:
            peak_h, peak = h, v
    trend = "rising" if d24 > 0.05 else "falling" if d24 < -0.05 else "steady"
    return {
        "current_m": _r2(cur), "danger_m": station.danger_m, "delta_24h_m": _r2(d24), "delta_48h_m": _r2(d48),
        "peak_m": _r2(peak), "peak_at": (t0 + timedelta(hours=peak_h)).isoformat().replace("+00:00", "Z"),
        "trend": trend,
        "readings": [{"timestamp": r.timestamp.isoformat().replace("+00:00", "Z"), "level_m": r.level_m,
                      "is_forecast": r.is_forecast} for r in readings],
    }
