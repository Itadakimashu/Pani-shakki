/**
 * Plain-language Bangla (and English) alert generator — mirrored in backend/core/alerts.py.
 * Short, template-based, one action per sentence, read aloud with speechSynthesis.
 */
import { asciiToBnDigits } from './classifier/classifier';
import type { Alert, AlertLevel, Shelter, StationForecast, Union } from './types';

const DHAKA_OFFSET_H = 6; // Bangladesh Standard Time, no DST
const FT_PER_M = 3.28084;

export function feetPhraseBn(ft: number): string {
  const half = Math.round(ft * 2) / 2;
  const v = Math.max(0.5, half);
  if (v === 0.5) return 'আধা ফুট';
  if (v === 1.5) return 'দেড় ফুট';
  if (v === 2.5) return 'আড়াই ফুট';
  if (v % 1 === 0.5) return `সাড়ে ${asciiToBnDigits(Math.floor(v))} ফুট`;
  return `${asciiToBnDigits(v)} ফুট`;
}

export function feetPhraseEn(ft: number): string {
  const v = Math.max(0.5, Math.round(ft * 2) / 2);
  return `${v} ${v === 1 ? 'foot' : 'feet'}`;
}

function partOfDay(hour: number): [string, string] {
  if (hour >= 4 && hour < 6) return ['ভোরের', 'dawn'];
  if (hour >= 6 && hour < 12) return ['সকালের', 'morning'];
  if (hour >= 12 && hour < 15) return ['দুপুরের', 'midday'];
  if (hour >= 15 && hour < 18) return ['বিকেলের', 'afternoon'];
  if (hour >= 18 && hour < 20) return ['সন্ধ্যার', 'evening'];
  return ['রাতের', 'night'];
}

/** "আগামীকাল রাতের মধ্যে" / "by tomorrow night" for a target time, in Dhaka local time. */
export function timePhrase(targetMs: number, nowMs: number): [string, string] {
  const off = DHAKA_OFFSET_H * 3600_000;
  const day = (ms: number) => Math.floor((ms + off) / 86400_000);
  let dd = day(targetMs) - day(nowMs);
  let hour = new Date(targetMs + off).getUTCHours();
  if (hour < 4 && dd > 0) { dd -= 1; hour = 23; } // 1am "tomorrow" is still "tonight"
  const [pBn, pEn] = partOfDay(hour);
  if (dd <= 0) return [`আজ ${pBn} মধ্যে`, pEn === 'night' ? 'by tonight' : `by this ${pEn}`];
  if (dd === 1) return [`আগামীকাল ${pBn} মধ্যে`, `by tomorrow ${pEn}`];
  return [`আগামী দুই দিনের মধ্যে`, 'within the next two days'];
}

const TITLES: Record<AlertLevel, [string, string]> = {
  0: ['স্বাভাবিক', 'Normal'],
  1: ['সতর্ক থাকুন', 'Watch'],
  2: ['বন্যা সতর্কতা', 'Flood warning'],
  3: ['বিপদ! এখনই ব্যবস্থা নিন', 'Danger — act now'],
};

export function alertLevel(f: StationForecast): AlertLevel {
  if (f.current_m >= f.danger_m && f.trend !== 'falling') return 3;
  if (f.peak_m >= f.danger_m) return 2;
  if (f.peak_m >= f.danger_m - 0.3 && f.trend === 'rising') return 1;
  return 0;
}

export function generateAlert(
  union: Union, f: StationForecast, nowMs = Date.now(), shelter?: Shelter,
): Alert {
  const level = alertLevel(f);
  const tidal = f.station.model?.kind === 'tidal';
  const riseM = f.peak_m - f.current_m;
  const bn: string[] = [];
  const en: string[] = [];

  if (f.trend === 'falling' && riseM < 0.05) {
    bn.push('পানি কমতে শুরু করেছে।');
    en.push('Water has started to fall.');
  } else if (riseM >= 0.05) {
    const [tBn, tEn] = timePhrase(Date.parse(f.peak_at), nowMs);
    const ft = riseM * FT_PER_M;
    bn.push(`${tBn} ${tidal ? 'জোয়ারে ' : ''}পানি প্রায় ${feetPhraseBn(ft)} বাড়তে পারে।`);
    en.push(`Water may rise about ${feetPhraseEn(ft)} ${tEn}${tidal ? ' with the tide' : ''}.`);
  } else {
    bn.push('পানি এখন স্থির আছে।');
    en.push('Water is steady now.');
  }

  if (f.current_m >= f.danger_m) {
    bn.push(`${f.station.river_bn} নদীর পানি বিপদসীমার উপরে।`);
    en.push(`The ${f.station.river_en} is above danger level.`);
  } else if (f.peak_m >= f.danger_m) {
    bn.push(`${f.station.river_bn} নদীর পানি বিপদসীমা ছাড়াতে পারে।`);
    en.push(`The ${f.station.river_en} may cross danger level.`);
  }

  if (level === 3) {
    bn.push('শিশু, বয়স্ক ও গর্ভবতীদের নিয়ে এখনই আশ্রয়কেন্দ্রে যান।');
    en.push('Take children, elders and pregnant women to a shelter now.');
    if (shelter) {
      bn.push(`নিকটতম: ${shelter.name_bn}।`);
      en.push(`Nearest: ${shelter.name_en}.`);
    }
  } else if (level === 2) {
    bn.push('গবাদিপশু উঁচু জায়গায় সরান। শুকনা খাবার, খাবার পানি ও জরুরি কাগজ প্লাস্টিকে ভরে রাখুন।');
    en.push('Move livestock to higher ground. Pack dry food, drinking water and documents in plastic.');
  } else if (level === 1) {
    bn.push('গবাদিপশু উঁচু জায়গায় সরান।');
    en.push('Move livestock to higher ground.');
  } else if (f.trend === 'falling' && riseM < 0.05) {
    bn.push('তবুও সাবধানে থাকুন, ফুটানো পানি পান করুন।');
    en.push('Stay careful and drink boiled water.');
  } else {
    bn.push('এখন ভয়ের কিছু নেই। খবর শুনতে থাকুন।');
    en.push('No danger now. Keep listening for updates.');
  }

  const t0 = Math.floor(nowMs / 3600_000) * 3600_000;
  return {
    id: `alert-${union.id}-${t0}`,
    union_id: union.id,
    station_id: f.station.id,
    level,
    title_bn: TITLES[level][0],
    title_en: TITLES[level][1],
    text_bn: bn.join(' '),
    text_en: en.join(' '),
    valid_from: new Date(t0).toISOString(),
    valid_until: new Date(t0 + 12 * 3600_000).toISOString(),
    created_at: new Date(t0).toISOString(),
    source: f.source,
  };
}
