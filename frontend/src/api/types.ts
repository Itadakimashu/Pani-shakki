import type {
  Alert, DashboardSummary, NewReport, Report, ReportFilters, RiverStation, Shelter, StationForecast, Union,
} from '../lib/types';

export interface Api {
  mode: 'demo' | 'live';
  listUnions(): Promise<Union[]>;
  listStations(): Promise<RiverStation[]>;
  listShelters(): Promise<Shelter[]>;
  listReports(filters?: ReportFilters): Promise<Report[]>;
  createReport(input: NewReport): Promise<Report>;
  updateReport(id: string, patch: { status: Report['status'] }): Promise<Report>;
  getForecasts(union?: string): Promise<StationForecast[]>;
  getAlerts(union: string): Promise<Alert[]>;
  nearestShelters(lat: number, lng: number, limit?: number): Promise<Shelter[]>;
  dashboardSummary(): Promise<DashboardSummary>;
  resetDemo?(): Promise<void>;
}
