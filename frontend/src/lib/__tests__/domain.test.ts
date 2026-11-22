import { describe, expect, it } from 'vitest';
import seed from '../../data/seed.json';
import { feetPhraseBn, generateAlert, timePhrase, alertLevel } from '../alerts';
import { stationForecast, levelAt } from '../forecast';
import { trustScore, type TrustInput } from '../trust';
import { prioritize } from '../priority';
import { haversineKm } from '../geo';
import type { Report, RiverStation, Union } from '../types';

const NOW = Date.parse('2026-07-10T06:00:00Z'); // 12:00 Dhaka

describe('geo', () => {
  it('haversine Dhaka→Sirajganj ≈ 110 km', () => {
    const d = haversineKm(23.8103, 90.4125, 24.457, 89.712);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
});

describe('forecast + alerts', () => {
  const stations = seed.stations as RiverStation[];
  it('mock forecast is continuous at t=0', () => {
    for (const s of stations) expect(levelAt(s.model!, 0)).toBeCloseTo(s.model!.now_m, 5);
  });
  it('produces 25 readings from -24h to +48h', () => {
    const f = stationForecast(stations[0], NOW);
    expect(f.readings.length).toBe(25);
    expect(f.trend).toBe('rising');
  });
  it('Bangla feet phrases', () => {
    expect(feetPhraseBn(1)).toBe('১ ফুট');
    expect(feetPhraseBn(1.4)).toBe('দেড় ফুট');
    expect(feetPhraseBn(0.2)).toBe('আধা ফুট');
    expect(feetPhraseBn(3.6)).toBe('সাড়ে ৩ ফুট');
  });
  it('time phrase: tomorrow night', () => {
    const target = Date.parse('2026-07-11T15:00:00Z'); // 21:00 Dhaka next day
    expect(timePhrase(target, NOW)[0]).toBe('আগামীকাল রাতের মধ্যে');
    expect(timePhrase(Date.parse('2026-07-10T14:00:00Z'), NOW)[0]).toBe('আজ রাতের মধ্যে');
  });
  it('generates the canonical example sentence shape', () => {
    const union = (seed.unions as Union[]).find((u) => u.id === 'natuarpara')!;
    const f = stationForecast(stations.find((s) => s.id === 'kazipur')!, NOW);
    const a = generateAlert(union, f, NOW);
    expect(a.text_bn).toMatch(/পানি প্রায় .+ বাড়তে পারে।/);
    expect(a.text_bn).toContain('গবাদিপশু উঁচু জায়গায় সরান।');
    expect(a.level).toBe(alertLevel(f));
  });
  it('station above danger → level 3', () => {
    const f = stationForecast(stations.find((s) => s.id === 'chilmari')!, NOW);
    expect(alertLevel(f)).toBe(3);
  });
});

describe('trust scoring', () => {
  const u = { id: 'gabura', lat: 22.255, lng: 89.3 };
  const base: TrustInput = { id: 'a', text: 'আমরা আটকা পড়েছি, নৌকা পাঠান', lat: 22.256, lng: 89.301, device_id: 'd1', severity: 3, created_at: new Date(NOW).toISOString(), union_id: 'gabura' };
  it('clean report scores 1', () => {
    expect(trustScore(base, [], u).trust_score).toBe(1);
  });
  it('flags device spam + duplicates', () => {
    const others = [1, 2, 3].map((i) => ({ ...base, id: `s${i}`, created_at: new Date(NOW - i * 300_000).toISOString() }));
    const r = trustScore(base, others, u);
    expect(r.trust_flags).toEqual(expect.arrayContaining(['device_burst', 'duplicate']));
    expect(r.trust_score).toBeLessThan(0.5);
  });
  it('flags far-away GPS', () => {
    const r = trustScore({ ...base, lat: 23.81, lng: 90.41 }, [], u);
    expect(r.trust_flags).toContain('far_from_union');
  });
  it('flags contradiction with neighbours', () => {
    const calm = [0, 1, 2].map((i) => ({ ...base, id: `c${i}`, device_id: `x${i}`, severity: 0 }));
    expect(trustScore(base, calm, u).trust_flags).toContain('contradicts_nearby');
  });
});

describe('priority', () => {
  const mk = (id: string, severity: 0 | 1 | 2 | 3, hoursAgo: number, lat = 25, lng = 89): Report => ({
    id, union_id: 'x', text: '', lat, lng, location_source: 'gps', device_id: id, channel: 'app', severity,
    water_level: null, needs: [], signals: [], confidence: 1, trust_score: 1, trust_flags: [], status: 'open',
    created_at: new Date(NOW - hoursAgo * 3600_000).toISOString(),
  });
  it('severity first, then recency, then density', () => {
    const list = [mk('old3', 3, 5), mk('new2', 2, 0.1), mk('new3', 3, 0.2), mk('dense3', 3, 0.3, 22, 89), mk('n1', 0, 0.3, 22, 89.001), mk('n2', 0, 0.3, 22, 89.002), mk('n3', 0, 0.4, 22, 89.003)];
    const ids = prioritize(list, NOW).map((r) => r.id);
    expect(ids.slice(0, 4)).toEqual(['dense3', 'new3', 'old3', 'new2']);
  });
});
