"""Domain services shared by views and management commands."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from django.db import transaction

from .alerts import generate_alert
from .classifier import classify
from .forecast_sources import ForecastSource, Reading, get_source, hour_anchor, summarize
from .geo import nearest
from .models import Alert, ForecastReading, Report, RiverStation, Shelter, Union
from .trust import TrustInput, trust_score


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def apply_classification(report: Report) -> Report:
    c = classify(report.text)
    report.severity = c["severity"]
    report.water_level = c["water_level"]
    report.needs = c["needs"]
    report.signals = c["signals"]
    report.confidence = c["confidence"]
    return report


def apply_trust(report: Report, others: list[Report] | None = None) -> Report:
    if others is None:
        window = (report.created_at - timedelta(hours=6), report.created_at + timedelta(hours=6))
        others = list(Report.objects.filter(created_at__range=window).exclude(pk=report.pk))
    union = report.union
    res = trust_score(TrustInput.from_report(report), [TrustInput.from_report(o) for o in others], union.lat, union.lng)
    report.trust_score = res["trust_score"]
    report.trust_flags = res["trust_flags"]
    return report


def recompute_all_trust() -> None:
    reports = list(Report.objects.select_related("union"))
    inputs = [TrustInput.from_report(r) for r in reports]
    for r in reports:
        res = trust_score(TrustInput.from_report(r), inputs, r.union.lat, r.union.lng)
        r.trust_score, r.trust_flags = res["trust_score"], res["trust_flags"]
    Report.objects.bulk_update(reports, ["trust_score", "trust_flags"])


def station_readings(station: RiverStation, now: datetime | None = None, source: ForecastSource | None = None) -> list[Reading]:
    """Stored readings for the current hour anchor, else fetch from the source and store them."""
    source = source or get_source()
    t0 = hour_anchor(now)
    qs = ForecastReading.objects.filter(station=station, source=source.name,
                                        timestamp__gte=t0 - timedelta(hours=24), timestamp__lte=t0 + timedelta(hours=48))
    rows = list(qs.order_by("timestamp"))
    if rows and any(r.timestamp == t0 for r in rows):
        return [Reading(r.timestamp, r.level_m, r.is_forecast) for r in rows]
    readings = source.readings(station, now)
    with transaction.atomic():
        for r in readings:
            ForecastReading.objects.update_or_create(
                station=station, timestamp=r.timestamp, source=source.name,
                defaults={"level_m": r.level_m, "is_forecast": r.is_forecast})
    return readings


def station_forecast(station: RiverStation, now: datetime | None = None) -> dict:
    source = get_source()
    data = summarize(station, station_readings(station, now, source), now)
    data["source"] = source.name
    return data


def alerts_for_union(union: Union, now: datetime | None = None) -> list[Alert]:
    now = now or utcnow()
    station = union.station
    if station is None:
        return []
    f = station_forecast(station, now)
    open_shelters = [s for s in Shelter.objects.all() if s.occupancy < s.capacity]
    near = nearest(union.lat, union.lng, open_shelters, 1)
    fields = generate_alert(union, station, f, now, near[0][0] if near else None)
    alert, _ = Alert.objects.update_or_create(
        id=fields.pop("id"),
        defaults={"union": union, "station": station, "source": f["source"],
                  **{k: v for k, v in fields.items() if k not in ("union_id", "station_id")}})
    return [alert]
