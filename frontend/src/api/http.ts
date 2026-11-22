/** LIVE MODE: talks to the Django REST backend (VITE_API_URL or the URL saved in Settings). */
import type { Api } from './types';
import type { ReportFilters } from '../lib/types';

export function httpApi(base: string): Api {
  const root = base.replace(/\/+$/, '');
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${root}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }
  const qs = (o: Record<string, unknown>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '' && v !== 'all') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  return {
    mode: 'live',
    listUnions: () => req('/unions'),
    listStations: () => req('/stations'),
    listShelters: () => req('/shelters'),
    listReports: (f: ReportFilters = {}) => req(`/reports${qs({ ...f })}`),
    createReport: (input) => req('/reports', { method: 'POST', body: JSON.stringify(input) }),
    updateReport: (id, patch) => req(`/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    getForecasts: (union) => req(`/forecasts${qs({ union })}`),
    getAlerts: (union) => req(`/alerts${qs({ union })}`),
    nearestShelters: (lat, lng, limit = 3) => req(`/shelters/nearest${qs({ lat, lng, limit })}`),
    dashboardSummary: () => req('/dashboard/summary'),
  };
}
