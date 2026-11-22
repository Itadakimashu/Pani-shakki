import { mockApi } from './mock';
import { httpApi } from './http';
import type { Api } from './types';

export const API_URL_KEY = 'ps_api_url';

/** Demo mode is ON unless VITE_API_URL is set at build time or a backend URL is saved in Settings. */
export function configuredApiUrl(): string {
  let saved = '';
  try { saved = localStorage.getItem(API_URL_KEY) ?? ''; } catch { /* private mode */ }
  return (saved || import.meta.env.VITE_API_URL || '').trim();
}

const url = configuredApiUrl();
export const api: Api = url ? httpApi(url) : mockApi;
export const isDemo = api.mode === 'demo';
export type { Api };
