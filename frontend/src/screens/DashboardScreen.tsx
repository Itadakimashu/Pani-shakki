import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n/I18n';
import { SEVERITY, SHELTER_KIND } from '../i18n/strings';
import { useAsync } from '../hooks/useAsync';
import { prioritize } from '../lib/priority';
import type { Report, ReportFilters, Shelter } from '../lib/types';
import FloodMap, { reportPos, type MapLayers } from '../components/FloodMap';
import { NeedChips, SeverityChip, TrustChips, WaterChip } from '../components/Chips';
import UnionSelect from '../components/UnionSelect';

export default function DashboardScreen() {
  const { t, n, lang, pick, name, ago } = useI18n();
  const [filters, setFilters] = useState<ReportFilters>({ status: 'open', since_hours: 72 });
  const [layers, setLayers] = useState<MapLayers>({ reports: true, stations: true, shelters: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [near, setNear] = useState<Shelter[]>([]);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unions = useAsync(() => api.listUnions(), []);
  const shelters = useAsync(() => api.listShelters(), []);
  const forecasts = useAsync(() => api.getForecasts(), []);
  const reports = useAsync(() => api.listReports(filters), [JSON.stringify(filters)]);
  const summary = useAsync(() => api.dashboardSummary(), [reports.data]);

  const ranked = useMemo(() => prioritize(reports.data ?? []), [reports.data]);
  const selected = ranked.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected || !unions.data) { setNear([]); return; }
    const pos = reportPos(selected, unions.data);
    if (pos) api.nearestShelters(pos[0], pos[1], 3).then(setNear).catch(() => setNear([]));
  }, [selected, unions.data]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, []);

  async function toggleStatus(r: Report) {
    const status = r.status === 'open' ? 'responded' : 'open';
    const upd = await api.updateReport(r.id, { status });
    reports.setData((list) => (list ?? []).map((x) => (x.id === upd.id ? upd : x)).filter((x) => filters.status !== 'open' || x.status === 'open'));
    if (status === 'responded' && filters.status === 'open') setSelectedId(null);
  }

  const set = (patch: Partial<ReportFilters>) => { setSelectedId(null); setFilters((f) => ({ ...f, ...patch })); };
  const unionName = (id: string) => { const u = unions.data?.find((x) => x.id === id); return u ? name(u) : id; };
  const s = summary.data;
  const visible = showAll ? ranked : ranked.slice(0, 15);

  return (
    <section className="screen screen-wide">
      <h1 className="h1">{t('dashTitle')}</h1>

      {s && (
        <div className="tiles">
          <div className="tile"><div className="tile-n">{n(s.open)}</div><div className="tile-l">{t('open')}</div></div>
          <div className="tile tile-red"><div className="tile-n">{n(s.emergencies)}</div><div className="tile-l">{t('emergencies')}</div></div>
          <div className="tile tile-warn"><div className="tile-n">{n(s.flagged)}</div><div className="tile-l">{t('flagged')}</div></div>
          <div className="tile"><div className="tile-n">{n(s.stations_above_danger)}</div><div className="tile-l">{t('aboveDanger')}</div></div>
        </div>
      )}

      <div className="filters">
        {unions.data && <UnionSelect unions={unions.data} value={filters.union ?? ''} onChange={(v) => set({ union: v || undefined })} allLabel={t('allUnions')} />}
        <select className="select" value={filters.min_severity ?? ''} onChange={(e) => set({ min_severity: e.target.value === '' ? undefined : Number(e.target.value) })}>
          <option value="">{t('anySeverity')}</option>
          {[3, 2, 1].map((l) => <option key={l} value={l}>{n(l)} · {pick(SEVERITY[l as 1 | 2 | 3])}{l < 3 ? ` ${t('sevAtLeast')}` : ''}</option>)}
        </select>
        <select className="select" value={filters.since_hours ?? ''} onChange={(e) => set({ since_hours: e.target.value === '' ? undefined : Number(e.target.value) })}>
          <option value="6">{t('last6h')}</option>
          <option value="24">{t('last24h')}</option>
          <option value="72">{t('last72h')}</option>
          <option value="">{t('anyTime')}</option>
        </select>
        <select className="select" value={filters.status ?? 'all'} onChange={(e) => set({ status: e.target.value as ReportFilters['status'] })}>
          <option value="open">{t('statusOpen')}</option>
          <option value="all">{t('statusAll')}</option>
        </select>
      </div>

      <div className="layer-toggles">
        {(['reports', 'stations', 'shelters'] as const).map((k) => (
          <label key={k} className="toggle toggle-sm">
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
            <span>{t(k)}</span>
          </label>
        ))}
      </div>

      {unions.data && (
        <FloodMap
          reports={ranked} unions={unions.data} forecasts={forecasts.data ?? []} shelters={shelters.data ?? []}
          layers={layers} selected={selected} nearestShelters={near} onSelect={select} lang={lang} fmt={n}
        />
      )}
      <div className="legend small">
        {[0, 1, 2, 3].map((l) => <span key={l}><i className={`sw sev-bg-${l}`} />{pick(SEVERITY[l as 0 | 1 | 2 | 3])}</span>)}
        <span><i className="sw sw-station" />{t('stations')}</span>
        <span><i className="sw sw-shelter" />{t('shelters')}</span>
      </div>

      <div ref={panelRef} data-scroll-anchor>
        {selected && (
          <div className="card selected-card">
            <div className="row-between">
              <strong>{t('selected')}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>✕ {t('close')}</button>
            </div>
            <ReportBody r={selected} unionName={unionName(selected.union_id)} />
            {selected.lat == null && <div className="muted small">{t('noGpsShort')}</div>}
            <h3 className="h3">🏠 {t('shelters')}</h3>
            {near.map((sh) => (
              <div key={sh.id} className="shelter-row">
                <div>
                  <strong>{name(sh)}</strong>
                  <div className="muted small">{pick(SHELTER_KIND[sh.kind])} · {t('capacity')} {n(sh.occupancy)}/{n(sh.capacity)} · {n(Math.max(0, sh.capacity - sh.occupancy))} {t('free')}</div>
                </div>
                <div className="dist">{n(sh.distance_km ?? 0)} {t('km')}</div>
              </div>
            ))}
            <button className={`btn btn-block btn-lg ${selected.status === 'open' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleStatus(selected)}>
              {selected.status === 'open' ? `✅ ${t('markResponded')}` : `↩ ${t('reopen')}`}
            </button>
          </div>
        )}
      </div>

      <h2 className="h2">{t('priorityList')} ({n(ranked.length)})</h2>
      <div className="muted small">{t('priorityHint')}</div>
      {reports.loading && <p className="muted">{t('loading')}</p>}
      {!reports.loading && ranked.length === 0 && <p className="muted">{t('noReports')}</p>}
      <ol className="plist">
        {visible.map((r, i) => (
          <li key={r.id} className={`card prow sev-border-${r.severity}${r.id === selectedId ? ' prow-sel' : ''}`}>
            <div className="row-between">
              <span className="rank">#{n(i + 1)}</span>
              <span className="muted small">{unionName(r.union_id)} · {ago(r.created_at)} · {n(r.density)} {t('nearby')}</span>
            </div>
            <ReportBody r={r} />
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => select(r.id)}>📍 {t('showOnMap')}</button>
              <button className={`btn ${r.status === 'open' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleStatus(r)}>
                {r.status === 'open' ? `✅ ${t('markResponded')}` : t('responded')}
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!showAll && ranked.length > 15 && (
        <button className="btn btn-ghost btn-block" onClick={() => setShowAll(true)}>+ {n(ranked.length - 15)}</button>
      )}
    </section>
  );
}

function ReportBody({ r, unionName }: { r: Report; unionName?: string }) {
  const { lang } = useI18n();
  return (
    <>
      <p className="report-text" lang="bn">“{r.text}”</p>
      <div className="chip-row">
        <SeverityChip level={r.severity} />
        <WaterChip w={r.water_level} />
        <NeedChips needs={r.needs} />
        <TrustChips score={r.trust_score} flags={r.trust_flags} />
        {r.channel !== 'app' && <span className="chip">{r.channel.toUpperCase()}</span>}
        {unionName && <span className="chip">{lang === 'bn' ? 'ইউনিয়ন' : 'Union'}: {unionName}</span>}
      </div>
    </>
  );
}
