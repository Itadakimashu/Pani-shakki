import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { strings, type StringKey } from './strings';
import { asciiToBnDigits } from '../lib/classifier/classifier';

export type Lang = 'bn' | 'en';
interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: StringKey) => string;
  n: (x: number | string) => string;
  pick: (o: { bn: string; en: string }) => string;
  name: (o: { name_bn: string; name_en: string }) => string;
  ago: (iso: string) => string;
  clock: (iso: string) => string;
}

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('ps_lang') as Lang) || 'bn'; } catch { return 'bn'; }
  });
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('ps_lang', l); } catch { /* ignore */ }
  }, []);
  const value = useMemo<Ctx>(() => {
    const n = (x: number | string) => (lang === 'bn' ? asciiToBnDigits(x) : String(x));
    return {
      lang, setLang, n,
      t: (k) => strings[k][lang],
      pick: (o) => o[lang],
      name: (o) => (lang === 'bn' ? o.name_bn : o.name_en),
      ago: (iso) => {
        const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
        if (mins < 1) return lang === 'bn' ? 'এইমাত্র' : 'just now';
        if (mins < 60) return lang === 'bn' ? `${n(mins)} মিনিট আগে` : `${mins} min ago`;
        const h = Math.round(mins / 60);
        if (h < 24) return lang === 'bn' ? `${n(h)} ঘণ্টা আগে` : `${h} h ago`;
        const d = Math.round(h / 24);
        return lang === 'bn' ? `${n(d)} দিন আগে` : `${d} d ago`;
      },
      clock: (iso) => {
        const s = new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
          timeZone: 'Asia/Dhaka', weekday: 'short', hour: 'numeric', minute: '2-digit',
        });
        return s;
      },
    };
  }, [lang, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}
