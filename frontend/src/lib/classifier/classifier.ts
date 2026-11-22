/**
 * Pani Shakkhi Bangla flood-report classifier (browser side).
 * Mirrors backend/core/classifier/classifier.py exactly — both read the same rules.json.
 *
 * Severity: 0 normal · 1 rising · 2 flooded · 3 emergency
 */
import rawRules from './rules.json';

export type Severity = 0 | 1 | 2 | 3;
export type Need =
  | 'food' | 'boat' | 'medicine' | 'livestock' | 'drinking_water' | 'shelter' | 'rescue';

export interface WaterLevel {
  label: string; // ankle | knee | thigh | waist | chest | neck | over_head | feet
  feet: number;
  source: 'body' | 'measure';
}

export interface Classification {
  severity: Severity;
  score: number;
  confidence: number;
  water_level: WaterLevel | null;
  needs: Need[];
  signals: string[];
  normalized: string;
}

interface Rule { id: string; level: number; weight: number; pattern: string; unless?: string; requires?: string }
interface Rules {
  replacements: [string, string][];
  thresholds: Record<string, number>;
  severity_rules: Rule[];
  water_levels: { label: string; feet: number; pattern: string }[];
  number_words: Record<string, number>;
  units: Record<string, number>;
  needs: { need: Need; pattern: string }[];
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Unicode clean-up shared by text AND rule patterns. */
export function canon(s: string, lower = true): string {
  const out = s
    .replace(/য়/g, 'য়') // য + nukta -> য়
    .replace(/ড়/g, 'ড়') // ড + nukta -> ড়
    .replace(/ঢ়/g, 'ঢ়') // ঢ + nukta -> ঢ়
    .replace(/ /g, ' ')
    .replace(/[‌‍﻿]/g, '');
  return lower ? out.toLowerCase() : out;
}

export function bnToAsciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function asciiToBnDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

const rules = rawRules as unknown as Rules;
const REPLACEMENTS = rules.replacements.map(([a, b]) => [canon(a), canon(b)] as const);
// Patterns are canonicalised but NOT lower-cased (that would turn \\S into \\s).
const compile = (p: string) => new RegExp(canon(p, false), 'u');
const SEV_RULES = rules.severity_rules.map((r) => ({
  ...r,
  re: compile(r.pattern),
  unlessRe: r.unless ? compile(r.unless) : null,
  requiresRe: r.requires ? compile(r.requires) : null,
}));
const LEVEL_RULES = rules.water_levels.map((w) => ({ ...w, re: compile(w.pattern) }));
const NEED_RULES = rules.needs.map((n) => ({ ...n, re: compile(n.pattern) }));
const byLenDesc = (a: string, b: string) => b.length - a.length;
const NUMBER_WORDS: Record<string, number> = {};
for (const [k, v] of Object.entries(rules.number_words)) NUMBER_WORDS[canon(k)] = v;
const UNITS: Record<string, number> = {};
for (const [k, v] of Object.entries(rules.units)) UNITS[canon(k)] = v;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NUM_ALT = Object.keys(NUMBER_WORDS).sort(byLenDesc).map(escape).join('|');
const UNIT_ALT = Object.keys(UNITS).sort(byLenDesc).map(escape).join('|');
const MEASURE_RE = new RegExp(
  canon(`(^|\\s)(সাড়ে\\s*)?(\\d+(?:\\.\\d+)?|${NUM_ALT})\\s*(${UNIT_ALT})(?=\\s|$)`, false),
  'u',
);

export function normalize(text: string): string {
  let s = canon(text || '');
  s = bnToAsciiDigits(s);
  s = s.replace(/[।॥,;:!?"'“”‘’()\[\]{}\-–—/\\|]+/g, ' ');
  for (const [a, b] of REPLACEMENTS) s = s.split(a).join(b);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function extractWaterLevel(norm: string): WaterLevel | null {
  // Explicit measurement wins ("২ ফুট", "দেড় হাত", "সাড়ে তিন ফুট").
  const m = MEASURE_RE.exec(norm);
  if (m) {
    const half = m[2] ? 0.5 : 0;
    const numTok = m[3];
    const n = /^\d/.test(numTok) ? parseFloat(numTok) : NUMBER_WORDS[numTok];
    const feet = Math.floor((n + half) * UNITS[m[4]] * 10 + 0.5) / 10;
    if (feet > 0 && feet < 60) return { label: 'feet', feet, source: 'measure' };
  }
  let best: WaterLevel | null = null;
  for (const w of LEVEL_RULES) {
    if (w.re.test(norm) && (!best || w.feet > best.feet)) {
      best = { label: w.label, feet: w.feet, source: 'body' };
    }
  }
  return best;
}

export function extractNeeds(norm: string): Need[] {
  const out: Need[] = [];
  for (const n of NEED_RULES) if (n.re.test(norm) && !out.includes(n.need)) out.push(n.need);
  return out;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function classify(text: string): Classification {
  const norm = normalize(text);
  const score: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const signals: string[] = [];

  for (const r of SEV_RULES) {
    if (!r.re.test(norm)) continue;
    if (r.requiresRe && !r.requiresRe.test(norm)) continue;
    if (r.unlessRe && r.unlessRe.test(norm)) continue;
    score[r.level] += r.weight;
    signals.push(r.id);
  }

  const water = extractWaterLevel(norm);
  if (water) {
    const risingCtx = signals.includes('rising');
    if (water.source === 'body') {
      if (water.feet >= 4) score[3] += 3;
      else if (water.feet >= 1.5) score[2] += 2;
      else score[2] += 1;
      signals.push(`level_${water.label}`);
    } else if (risingCtx) {
      score[1] += 0.5; // "river rose 2 ft" — a rise, not standing water at home
      signals.push('level_measure_rise');
    } else {
      if (water.feet >= 4) score[3] += 2;
      else if (water.feet >= 1.5) score[2] += 1.5;
      else score[2] += 1;
      signals.push('level_measure');
    }
  }

  const t = rules.thresholds;
  const eff3 = score[3];
  const eff2 = score[2] + score[3];
  const eff1 = score[1] + eff2;
  let severity: Severity = 0;
  if (eff3 >= t['3']) severity = 3;
  else if (eff2 >= t['2']) severity = 2;
  else if (eff1 >= t['1'] && eff1 > score[0]) severity = 1;

  const top = severity === 3 ? eff3 : severity === 2 ? eff2 : severity === 1 ? eff1 : Math.max(score[0], 1);
  const thr = severity === 0 ? 1 : t[String(severity)];
  const confidence = signals.length === 0 ? 0.3 : Math.min(1, round2(0.5 + (top - thr) / (2 * thr) + 0.1 * Math.min(signals.length, 3)));

  return {
    severity,
    score: round2(score[3] * 3 + score[2] * 2 + score[1]),
    confidence: Math.max(0.3, confidence),
    water_level: water,
    needs: extractNeeds(norm),
    signals,
    normalized: norm,
  };
}
