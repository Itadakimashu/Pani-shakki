import type { Report, ReportFilters } from '../lib/types';

export function applyFilters(list: Report[], f: ReportFilters = {}, nowMs = Date.now()): Report[] {
  return list.filter((r) =>
    (!f.union || r.union_id === f.union) &&
    (f.min_severity == null || r.severity >= f.min_severity) &&
    (!f.since_hours || nowMs - Date.parse(r.created_at) <= f.since_hours * 3600_000) &&
    (!f.status || f.status === 'all' || r.status === f.status));
}
