/** Responder priority: severity ↓, then recency (1-hour buckets) ↓, then local report density ↓. */
import { haversineKm } from './geo';
import type { Report } from './types';

export function density(r: Report, all: Report[], nowMs = Date.now()): number {
  if (r.lat == null || r.lng == null) return 0;
  return all.filter((o) => o.id !== r.id && o.lat != null && o.lng != null &&
    nowMs - Date.parse(o.created_at) <= 24 * 3600_000 &&
    haversineKm(r.lat!, r.lng!, o.lat!, o.lng!) <= 3).length;
}

export function prioritize(reports: Report[], nowMs = Date.now()): (Report & { density: number })[] {
  const withD = reports.map((r) => ({ ...r, density: density(r, reports, nowMs) }));
  const bucket = (r: Report) => Math.floor((nowMs - Date.parse(r.created_at)) / 3600_000);
  return withD.sort((a, b) =>
    b.severity - a.severity ||
    bucket(a) - bucket(b) ||
    b.density - a.density ||
    Date.parse(b.created_at) - Date.parse(a.created_at));
}
