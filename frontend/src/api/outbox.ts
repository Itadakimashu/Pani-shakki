/** Offline queue: reports are saved to IndexedDB first, then synced when online. */
import { openDB } from 'idb';
import type { NewReport } from '../lib/types';
import { api } from './index';

export interface Queued extends NewReport { queued_at: string; attempts: number; last_error?: string }

const SIM_OFFLINE_KEY = 'ps_sim_offline';
const listeners = new Set<() => void>();
export const onOutboxChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((f) => f());

const dbp = () => openDB('pani-shakkhi-outbox', 1, {
  upgrade(d) { d.createObjectStore('queue', { keyPath: 'client_id' }); },
});

export function simulatedOffline(): boolean {
  try { return localStorage.getItem(SIM_OFFLINE_KEY) === '1'; } catch { return false; }
}
export function setSimulatedOffline(on: boolean) {
  localStorage.setItem(SIM_OFFLINE_KEY, on ? '1' : '0');
  emit();
  if (!on) void flush();
}
export const isOnline = () => navigator.onLine && !simulatedOffline();

export async function enqueue(r: NewReport) {
  const d = await dbp();
  await d.put('queue', { ...r, created_at: r.created_at ?? new Date().toISOString(), queued_at: new Date().toISOString(), attempts: 0 } satisfies Queued);
  emit();
}

export async function pending(): Promise<Queued[]> {
  return (await (await dbp()).getAll('queue')) as Queued[];
}

let flushing = false;
export async function flush(): Promise<number> {
  if (flushing || !isOnline()) return 0;
  flushing = true;
  let sent = 0;
  try {
    const d = await dbp();
    for (const q of (await d.getAll('queue')) as Queued[]) {
      try {
        const { queued_at: _q, attempts: _a, last_error: _e, ...body } = q;
        await api.createReport(body);
        await d.delete('queue', q.client_id);
        sent++;
      } catch (e) {
        await d.put('queue', { ...q, attempts: q.attempts + 1, last_error: String(e) });
      }
    }
  } finally {
    flushing = false;
    emit();
  }
  return sent;
}

/** Submit: queue first (never lose a report), then try to send immediately. */
export async function submitReport(r: NewReport): Promise<'sent' | 'queued'> {
  await enqueue(r);
  if (!isOnline()) return 'queued';
  await flush();
  const still = (await pending()).some((q) => q.client_id === r.client_id);
  return still ? 'queued' : 'sent';
}

export function startAutoSync() {
  window.addEventListener('online', () => void flush());
  setInterval(() => void flush(), 30_000);
  void flush();
}
