"""Trust scoring — mirrors frontend/src/lib/trust.ts. Lower score = more likely fake/duplicate."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from statistics import median

from .classifier import normalize
from .geo import haversine_km

HOUR = 3600.0


@dataclass
class TrustInput:
    id: str
    text: str
    lat: float | None
    lng: float | None
    device_id: str
    severity: int
    created_at: datetime
    union_id: str

    @classmethod
    def from_report(cls, r) -> "TrustInput":
        return cls(r.id, r.text, r.lat, r.lng, r.device_id, r.severity, r.created_at, r.union_id)


def trust_score(r: TrustInput, others: list[TrustInput], union_lat: float | None, union_lng: float | None):
    score = 1.0
    flags: list[str] = []
    peers = [o for o in others if o.id != r.id]
    dt = lambda o: abs((o.created_at - r.created_at).total_seconds())  # noqa: E731

    same_device = [o for o in peers if o.device_id == r.device_id]
    if len([o for o in same_device if dt(o) <= 0.5 * HOUR]) >= 2:
        score -= 0.3
        flags.append("device_burst")
    norm = normalize(r.text)
    if any(dt(o) <= 6 * HOUR and normalize(o.text) == norm for o in same_device):
        score -= 0.35
        flags.append("duplicate")

    if r.lat is None or r.lng is None:
        score -= 0.05
        flags.append("no_gps")
    elif union_lat is not None and union_lng is not None:
        d = haversine_km(r.lat, r.lng, union_lat, union_lng)
        if d > 40:
            score -= 0.45
            flags.append("far_from_union")
        elif d > 15:
            score -= 0.25
            flags.append("far_from_union")

    lat = r.lat if r.lat is not None else union_lat
    lng = r.lng if r.lng is not None else union_lng
    if lat is not None and lng is not None:
        nearby = [o for o in peers if o.device_id != r.device_id and o.lat is not None and o.lng is not None
                  and dt(o) <= 6 * HOUR and haversine_km(lat, lng, o.lat, o.lng) <= 5]
        if len(nearby) >= 2:
            diff = abs(r.severity - median([o.severity for o in nearby]))
            if diff >= 2:
                score -= 0.25
                flags.append("contradicts_nearby")
            elif diff <= 1:
                score += 0.1
                flags.append("corroborated")

    if len([w for w in norm.split(" ") if w]) < 2:
        score -= 0.1
        flags.append("too_short")

    score = min(1.0, max(0.0, score))
    return {"trust_score": round(score, 2), "trust_flags": flags}
