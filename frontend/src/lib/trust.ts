/** Trust scoring — mirrored in backend/core/trust.py. Lower score = more likely fake/duplicate. */
import { haversineKm } from './geo';
import { normalize } from './classifier/classifier';

export interface TrustInput {
  id: string; text: string; lat: number | null; lng: number | null; device_id: string;
  severity: number; created_at: string; union_id: string;
}
export interface UnionPoint { id: string; lat: number; lng: number }

const H = 3600_000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function trustScore(r: TrustInput, others: TrustInput[], union: UnionPoint | undefined) {
  let score = 1;
  const flags: string[] = [];
  const t = Date.parse(r.created_at);
  const peers = others.filter((o) => o.id !== r.id);

  const sameDevice = peers.filter((o) => o.device_id === r.device_id);
  if (sameDevice.filter((o) => Math.abs(Date.parse(o.created_at) - t) <= 0.5 * H).length >= 2) {
    score -= 0.3; flags.push('device_burst');
  }
  const norm = normalize(r.text);
  if (sameDevice.some((o) => Math.abs(Date.parse(o.created_at) - t) <= 6 * H && normalize(o.text) === norm)) {
    score -= 0.35; flags.push('duplicate');
  }

  if (r.lat == null || r.lng == null) {
    score -= 0.05; flags.push('no_gps');
  } else if (union) {
    const d = haversineKm(r.lat, r.lng, union.lat, union.lng);
    if (d > 40) { score -= 0.45; flags.push('far_from_union'); }
    else if (d > 15) { score -= 0.25; flags.push('far_from_union'); }
  }

  const lat = r.lat ?? union?.lat;
  const lng = r.lng ?? union?.lng;
  if (lat != null && lng != null) {
    const nearby = peers.filter((o) => o.device_id !== r.device_id && o.lat != null && o.lng != null &&
      Math.abs(Date.parse(o.created_at) - t) <= 6 * H && haversineKm(lat, lng, o.lat!, o.lng!) <= 5);
    if (nearby.length >= 2) {
      const diff = Math.abs(r.severity - median(nearby.map((o) => o.severity)));
      if (diff >= 2) { score -= 0.25; flags.push('contradicts_nearby'); }
      else if (diff <= 1) { score += 0.1; flags.push('corroborated'); }
    }
  }

  if (norm.split(' ').filter(Boolean).length < 2) { score -= 0.1; flags.push('too_short'); }

  return { trust_score: Math.round(Math.min(1, Math.max(0, score)) * 100) / 100, trust_flags: flags };
}
