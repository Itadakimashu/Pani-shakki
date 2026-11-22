import type { DashboardSummary, Report, StationForecast } from '../lib/types';

export function summarize(reports: Report[], forecasts: StationForecast[]): DashboardSummary {
  const by_severity: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0 };
  const needs: Record<string, number> = {};
  const byUnion = new Map<string, { union_id: string; total: number; open: number; max_severity: number }>();
  for (const r of reports) {
    by_severity[String(r.severity)]++;
    for (const n of r.needs) needs[n] = (needs[n] ?? 0) + 1;
    const u = byUnion.get(r.union_id) ?? { union_id: r.union_id, total: 0, open: 0, max_severity: 0 };
    u.total++;
    if (r.status === 'open') u.open++;
    u.max_severity = Math.max(u.max_severity, r.severity);
    byUnion.set(r.union_id, u);
  }
  return {
    total: reports.length,
    open: reports.filter((r) => r.status === 'open').length,
    responded: reports.filter((r) => r.status === 'responded').length,
    emergencies: reports.filter((r) => r.severity === 3 && r.status === 'open').length,
    flagged: reports.filter((r) => r.trust_score < 0.5).length,
    by_severity,
    by_union: [...byUnion.values()].sort((a, b) => b.max_severity - a.max_severity || b.open - a.open),
    needs,
    stations_above_danger: forecasts.filter((f) => f.current_m >= f.danger_m).length,
    generated_at: new Date().toISOString(),
  };
}
