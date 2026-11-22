/** Deterministic mock forecast model — mirrored by MockForecastSource in backend/core/forecast_sources.py. */
import type { Reading, RiverStation, StationForecast, StationModel } from './types';

export function levelAt(m: StationModel, h: number): number {
  if (m.kind === 'tidal') {
    const w = (2 * Math.PI) / m.period_h!;
    return m.now_m + m.amp! * (Math.sin(w * (h + m.phase_h!)) - Math.sin(w * m.phase_h!)) + m.trend! * h;
  }
  if (h <= 0) return m.now_m + m.past_rate! * h;
  if (h <= m.peak_h!) return m.now_m + m.peak_delta! * Math.sin((Math.PI / 2) * (h / m.peak_h!));
  return m.now_m + m.peak_delta! - m.fall_rate! * (h - m.peak_h!);
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function hourAnchor(nowMs = Date.now()): number {
  return Math.floor(nowMs / 3600_000) * 3600_000;
}

export function stationForecast(st: RiverStation, nowMs = Date.now()): StationForecast {
  const m = st.model!;
  const t0 = hourAnchor(nowMs);
  const readings: Reading[] = [];
  for (let h = -24; h <= 48; h += 3) {
    readings.push({ timestamp: new Date(t0 + h * 3600_000).toISOString(), level_m: r2(levelAt(m, h)), is_forecast: h > 0 });
  }
  let peak = -Infinity, peakH = 0;
  for (let h = 0; h <= 48; h++) {
    const v = levelAt(m, h);
    if (v > peak + 1e-9) { peak = v; peakH = h; }
  }
  const cur = levelAt(m, 0);
  const d24 = levelAt(m, 24) - cur;
  const d48 = levelAt(m, 48) - cur;
  const trend = d24 > 0.05 ? 'rising' : d24 < -0.05 ? 'falling' : 'steady';
  return {
    station: st, current_m: r2(cur), danger_m: st.danger_m, delta_24h_m: r2(d24), delta_48h_m: r2(d48),
    peak_m: r2(peak), peak_at: new Date(t0 + peakH * 3600_000).toISOString(), trend, readings, source: 'mock',
  };
}
