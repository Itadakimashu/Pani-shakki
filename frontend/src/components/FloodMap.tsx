import { useEffect, useRef } from 'react';
import L from '../lib/leaflet';
import 'leaflet.markercluster';
import type { Report, Shelter, StationForecast, Union } from '../lib/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface MapLayers { reports: boolean; stations: boolean; shelters: boolean }

interface Props {
  reports: Report[];
  unions: Union[];
  forecasts: StationForecast[];
  shelters: Shelter[];
  layers: MapLayers;
  selected: Report | null;
  nearestShelters: Shelter[];
  onSelect: (id: string) => void;
  lang: 'bn' | 'en';
  fmt: (x: number | string) => string;
}

/** Position of a report: GPS if present, else its union centre. */
export function reportPos(r: Report, unions: Union[]): [number, number] | null {
  if (r.lat != null && r.lng != null) return [r.lat, r.lng];
  const u = unions.find((x) => x.id === r.union_id);
  return u ? [u.lat, u.lng] : null;
}

export default function FloodMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const groups = useRef<{ reports: L.MarkerClusterGroup; stations: L.LayerGroup; shelters: L.LayerGroup; sel: L.LayerGroup } | null>(null);
  const onSelect = useRef(p.onSelect);
  onSelect.current = p.onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, preferCanvas: true, tap: true } as L.MapOptions).setView([24.0, 90.3], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    const reports = L.markerClusterGroup({
      maxClusterRadius: 45,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const kids = c.getAllChildMarkers() as (L.Marker & { options: { sev?: number } })[];
        const max = Math.max(...kids.map((k) => k.options.sev ?? 0));
        return L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: `cluster sev-bg-${max}`, iconSize: [40, 40] });
      },
    });
    groups.current = { reports, stations: L.layerGroup(), shelters: L.layerGroup(), sel: L.layerGroup().addTo(m) };
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; };
  }, []);

  // Reports
  useEffect(() => {
    const g = groups.current; const m = map.current;
    if (!g || !m) return;
    g.reports.clearLayers();
    const markers: L.Marker[] = [];
    for (const r of p.reports) {
      const pos = reportPos(r, p.unions);
      if (!pos) continue;
      const mk = L.marker(pos, {
        sev: r.severity,
        icon: L.divIcon({
          className: `pin sev-bg-${r.severity}${r.status === 'responded' ? ' pin-done' : ''}${r.trust_score < 0.5 ? ' pin-flag' : ''}`,
          html: `<span>${p.fmt(r.severity)}</span>`, iconSize: [30, 30],
        }),
        title: r.text,
        keyboard: true,
      } as L.MarkerOptions);
      mk.on('click', () => onSelect.current(r.id));
      markers.push(mk);
    }
    g.reports.addLayers(markers);
    if (p.layers.reports) g.reports.addTo(m); else g.reports.remove();
  }, [p.reports, p.unions, p.layers.reports, p.fmt]);

  // Stations
  useEffect(() => {
    const g = groups.current; const m = map.current;
    if (!g || !m) return;
    g.stations.clearLayers();
    for (const f of p.forecasts) {
      const above = f.current_m >= f.danger_m;
      const s = f.station;
      const arrow = f.trend === 'rising' ? '↑' : f.trend === 'falling' ? '↓' : '→';
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: `station-pin${above ? ' above' : ''}`, html: `〰${arrow}`, iconSize: [36, 28] }),
        zIndexOffset: -1000,
      })
        .bindPopup(`<strong>${esc(p.lang === 'bn' ? `${s.river_bn} · ${s.name_bn}` : `${s.river_en} · ${s.name_en}`)}</strong><br>` +
          `${p.lang === 'bn' ? 'এখন' : 'Now'}: ${p.fmt(f.current_m.toFixed(2))} m · ${p.lang === 'bn' ? 'বিপদসীমা' : 'Danger'}: ${p.fmt(f.danger_m.toFixed(2))} m<br>` +
          `${p.lang === 'bn' ? '২৪ ঘণ্টায়' : '24h'}: ${f.delta_24h_m >= 0 ? '+' : ''}${p.fmt(f.delta_24h_m.toFixed(2))} m`)
        .addTo(g.stations);
    }
    if (p.layers.stations) g.stations.addTo(m); else g.stations.remove();
  }, [p.forecasts, p.layers.stations, p.lang, p.fmt]);

  // Shelters
  useEffect(() => {
    const g = groups.current; const m = map.current;
    if (!g || !m) return;
    g.shelters.clearLayers();
    for (const s of p.shelters) {
      const free = s.capacity - s.occupancy;
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: `shelter-pin${free <= 0 ? ' full' : ''}`, html: '⌂', iconSize: [26, 26] }),
        zIndexOffset: -2000,
      })
        .bindPopup(`<strong>${esc(p.lang === 'bn' ? s.name_bn : s.name_en)}</strong><br>` +
          `${p.lang === 'bn' ? 'ধারণক্ষমতা' : 'Capacity'}: ${p.fmt(s.occupancy)}/${p.fmt(s.capacity)}`)
        .addTo(g.shelters);
    }
    if (p.layers.shelters) g.shelters.addTo(m); else g.shelters.remove();
  }, [p.shelters, p.layers.shelters, p.lang, p.fmt]);

  // Selection: highlight + lines to nearest shelters
  useEffect(() => {
    const g = groups.current; const m = map.current;
    if (!g || !m) return;
    g.sel.clearLayers();
    if (!p.selected) return;
    const pos = reportPos(p.selected, p.unions);
    if (!pos) return;
    L.circleMarker(pos, { radius: 20, color: '#0b5394', weight: 3, fill: false }).addTo(g.sel);
    for (const s of p.nearestShelters) {
      L.polyline([pos, [s.lat, s.lng]], { color: '#0b5394', weight: 2, dashArray: '6 6' }).addTo(g.sel);
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: 'dist-label', html: `${p.fmt(s.distance_km ?? 0)} km`, iconSize: [64, 22], iconAnchor: [32, -8] }),
        interactive: false,
      }).addTo(g.sel);
    }
    const pts = [pos, ...p.nearestShelters.map((s) => [s.lat, s.lng] as [number, number])];
    m.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 13 });
  }, [p.selected, p.nearestShelters, p.unions, p.fmt]);

  // Fit to all reports when the filtered set changes and nothing is selected
  useEffect(() => {
    const m = map.current;
    if (!m || p.selected) return;
    const pts = p.reports.map((r) => reportPos(r, p.unions)).filter(Boolean) as [number, number][];
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.reports.length, p.unions]);

  return <div ref={el} className="map" role="region" aria-label="Flood map" />;
}
