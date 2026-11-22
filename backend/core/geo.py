import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest(lat: float, lng: float, items, limit: int = 3):
    """items: iterable of objects with .lat/.lng. Returns [(item, distance_km)] sorted by distance."""
    scored = [(it, math.floor(haversine_km(lat, lng, it.lat, it.lng) * 10 + 0.5) / 10) for it in items]
    scored.sort(key=lambda x: x[1])
    return scored[:limit]
