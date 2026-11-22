import { describe, expect, it } from 'vitest';
import { mockApi } from '../mock';

describe('mock API (IndexedDB demo mode)', () => {
  it('seeds ~60 demo reports with classifier + trust applied', async () => {
    const all = await mockApi.listReports();
    expect(all.length).toBeGreaterThanOrEqual(55);
    expect(all.every((r) => r.is_demo)).toBe(true);
    expect(all.some((r) => r.trust_flags.includes('duplicate'))).toBe(true);
    expect(all.some((r) => r.trust_flags.includes('far_from_union'))).toBe(true);
    expect(all.some((r) => r.trust_flags.includes('contradicts_nearby'))).toBe(true);
  });
  it('creates, filters and updates reports idempotently', async () => {
    const input = { client_id: 'test-1', union_id: 'gabura', text: 'ঘরে কোমর পানি, নৌকা দরকার', lat: 22.255, lng: 89.3, location_source: 'gps' as const, device_id: 'dev-test' };
    const r = await mockApi.createReport(input);
    expect(r.severity).toBe(2);
    expect(r.needs).toContain('boat');
    const again = await mockApi.createReport(input);
    expect(again.id).toBe(r.id);
    const filtered = await mockApi.listReports({ union: 'gabura', min_severity: 2 });
    expect(filtered.some((x) => x.id === 'test-1')).toBe(true);
    const upd = await mockApi.updateReport('test-1', { status: 'responded' });
    expect(upd.status).toBe('responded');
  });
  it('alerts, forecasts, shelters, summary', async () => {
    const alerts = await mockApi.getAlerts('ashtamir_char');
    expect(alerts[0].text_bn.length).toBeGreaterThan(10);
    expect((await mockApi.getForecasts()).length).toBe(8);
    expect((await mockApi.getForecasts('gabura')).length).toBe(1);
    const sh = await mockApi.nearestShelters(22.255, 89.3, 3);
    expect(sh[0].distance_km).toBeLessThan(sh[2].distance_km!);
    const s = await mockApi.dashboardSummary();
    expect(s.total).toBeGreaterThan(50);
  });
});
