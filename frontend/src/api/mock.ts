/**
 * DEMO MODE: an in-browser mock of the Django API, backed by IndexedDB and seeded with demo data.
 * Same request/response shapes as the real backend (see docs/api.md).
 */
import { openDB, type IDBPDatabase } from 'idb';
import seed from '../data/seed.json';
import { classify } from '../lib/classifier/classifier';
import { trustScore } from '../lib/trust';
import { stationForecast } from '../lib/forecast';
import { generateAlert } from '../lib/alerts';
import { nearest } from '../lib/geo';
import type { NewReport, Report, RiverStation, Shelter, Union } from '../lib/types';
import type { Api } from './types';
import { applyFilters } from './filters';
import { summarize } from './summary';

const unions = seed.unions as Union[];
const stations = seed.stations as RiverStation[];
const shelters = seed.shelters as Shelter[];
const unionById = new Map(unions.map((u) => [u.id, u]));

type DB = IDBPDatabase<unknown>;
let dbp: Promise<DB> | null = null;

function db(): Promise<DB> {
  if (!dbp) {
    dbp = openDB('pani-shakkhi-demo', 1, {
      upgrade(d) {
        d.createObjectStore('reports', { keyPath: 'id' });
        d.createObjectStore('meta');
      },
    }).then(async (d) => {
      await ensureSeeded(d);
      return d;
    });
  }
  return dbp;
}

function buildReport(input: Omit<NewReport, 'client_id' | 'channel'> & { id: string; status?: Report['status']; channel?: Report['channel'] }, createdAt: string): Report {
  const c = classify(input.text);
  return {
    id: input.id, union_id: input.union_id, text: input.text, audio_url: null,
    lat: input.lat, lng: input.lng, location_source: input.location_source, device_id: input.device_id,
    channel: input.channel ?? 'app', severity: c.severity, water_level: c.water_level, needs: c.needs,
    signals: c.signals, confidence: c.confidence, trust_score: 1, trust_flags: [],
    status: input.status ?? 'open', created_at: createdAt, responded_at: null,
  };
}

async function ensureSeeded(d: DB, force = false) {
  const v = await d.get('meta', 'seed_version');
  if (!force && v === seed.version) return;
  const now = Date.now();
  const reports = (seed.reports as Array<{
    id: string; union_id: string; text: string; lat: number | null; lng: number | null;
    location_source: 'gps' | 'manual'; device_id: string; hours_ago: number; status: Report['status']; channel: Report['channel'];
  }>).map((s) => ({
    ...buildReport(s, new Date(now - s.hours_ago * 3600_000).toISOString()),
    is_demo: true,
    responded_at: s.status === 'responded' ? new Date(now - s.hours_ago * 1800_000).toISOString() : null,
  }));
  for (const r of reports) Object.assign(r, trustScore(r, reports, unionById.get(r.union_id)));
  const tx = d.transaction(['reports', 'meta'], 'readwrite');
  await tx.objectStore('reports').clear();
  for (const r of reports) await tx.objectStore('reports').put(r);
  await tx.objectStore('meta').put(seed.version, 'seed_version');
  await tx.done;
}

const allReports = async () => (await (await db()).getAll('reports')) as Report[];

export const mockApi: Api = {
  mode: 'demo',
  async listUnions() { return unions; },
  async listStations() { return stations; },
  async listShelters() { return shelters; },

  async listReports(filters) {
    const list = applyFilters(await allReports(), filters);
    return list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  },

  async createReport(input) {
    const d = await db();
    const existing = (await d.get('reports', input.client_id)) as Report | undefined;
    if (existing) return existing; // idempotent replay from the offline queue
    if (!unionById.has(input.union_id)) throw new Error('unknown union');
    const r = buildReport({ ...input, id: input.client_id }, input.created_at ?? new Date().toISOString());
    Object.assign(r, trustScore(r, await allReports(), unionById.get(r.union_id)));
    await d.put('reports', r);
    return r;
  },

  async updateReport(id, patch) {
    const d = await db();
    const r = (await d.get('reports', id)) as Report | undefined;
    if (!r) throw new Error('not found');
    r.status = patch.status;
    r.responded_at = patch.status === 'responded' ? new Date().toISOString() : null;
    await d.put('reports', r);
    return r;
  },

  async getForecasts(union) {
    const now = Date.now();
    const st = union ? stations.filter((s) => s.id === unionById.get(union)?.station_id) : stations;
    return st.map((s) => stationForecast(s, now));
  },

  async getAlerts(union) {
    const u = unionById.get(union);
    if (!u) return [];
    const now = Date.now();
    const f = stationForecast(stations.find((s) => s.id === u.station_id)!, now);
    const [sh] = nearest(u.lat, u.lng, shelters.filter((s) => s.occupancy < s.capacity), 1);
    return [generateAlert(u, f, now, sh)];
  },

  async nearestShelters(lat, lng, limit = 3) {
    return nearest(lat, lng, shelters, limit);
  },

  async dashboardSummary() {
    return summarize(await allReports(), await this.getForecasts());
  },

  async resetDemo() {
    await ensureSeeded(await db(), true);
  },
};
