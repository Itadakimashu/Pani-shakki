export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearest<T extends { lat: number; lng: number }>(lat: number, lng: number, items: T[], limit = 3) {
  return items
    .map((it) => ({ ...it, distance_km: Math.round(haversineKm(lat, lng, it.lat, it.lng) * 10) / 10 }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}
