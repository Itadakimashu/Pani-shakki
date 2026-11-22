import type { Need, Severity, WaterLevel } from './classifier/classifier';

export type { Need, Severity, WaterLevel };
export type ReportStatus = 'open' | 'responded';

export interface Union {
  id: string; name_bn: string; name_en: string; upazila_bn: string; upazila_en: string;
  district_bn: string; district_en: string; lat: number; lng: number; kind: 'char' | 'haor' | 'coastal'; station_id: string;
}

export interface Report {
  id: string;
  union_id: string;
  text: string;
  audio_url?: string | null;
  lat: number | null;
  lng: number | null;
  location_source: 'gps' | 'manual';
  device_id: string;
  channel: 'app' | 'sms' | 'ivr';
  severity: Severity;
  water_level: WaterLevel | null;
  needs: Need[];
  signals: string[];
  confidence: number;
  trust_score: number;
  trust_flags: string[];
  status: ReportStatus;
  created_at: string; // ISO
  responded_at?: string | null;
  is_demo?: boolean;
}

export interface NewReport {
  client_id: string; // idempotency key from offline queue
  union_id: string;
  text: string;
  lat: number | null;
  lng: number | null;
  location_source: 'gps' | 'manual';
  device_id: string;
  channel?: 'app';
  created_at?: string;
}

export interface StationModel {
  kind: 'riverine' | 'tidal';
  now_m: number;
  past_rate?: number; peak_delta?: number; peak_h?: number; fall_rate?: number;
  amp?: number; period_h?: number; phase_h?: number; trend?: number;
}

export interface RiverStation {
  id: string; name_bn: string; name_en: string; river_bn: string; river_en: string;
  lat: number; lng: number; danger_m: number; model?: StationModel;
}

export interface Reading { timestamp: string; level_m: number; is_forecast: boolean }

export interface StationForecast {
  station: RiverStation;
  current_m: number;
  danger_m: number;
  delta_24h_m: number;
  delta_48h_m: number;
  peak_m: number;
  peak_at: string;
  trend: 'rising' | 'falling' | 'steady';
  readings: Reading[];
  source: string;
}

export interface Shelter {
  id: string; union_id: string; name_bn: string; name_en: string;
  kind: 'school' | 'flood_shelter' | 'cyclone_shelter' | 'embankment';
  capacity: number; occupancy: number; lat: number; lng: number; distance_km?: number;
}

export type AlertLevel = 0 | 1 | 2 | 3;
export interface Alert {
  id: string; union_id: string; station_id: string; level: AlertLevel;
  title_bn: string; title_en: string; text_bn: string; text_en: string;
  valid_from: string; valid_until: string; created_at: string; source: string;
}

export interface ReportFilters {
  union?: string;
  min_severity?: number;
  since_hours?: number;
  status?: ReportStatus | 'all';
}

export interface DashboardSummary {
  total: number; open: number; responded: number; emergencies: number; flagged: number;
  by_severity: Record<string, number>;
  by_union: { union_id: string; total: number; open: number; max_severity: number }[];
  needs: Record<string, number>;
  stations_above_danger: number;
  generated_at: string;
}
