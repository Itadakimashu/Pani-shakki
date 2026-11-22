/** Web Speech API recognition in Bangla: tries bn-BD, falls back to bn-IN. */
import { useCallback, useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;
const getSR = (): (new () => SR) | null =>
  typeof window === 'undefined' ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

export type RecError = 'unsupported' | 'denied' | 'failed' | null;

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = !!getSR();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<RecError>(supported ? null : 'unsupported');
  const [langUsed, setLangUsed] = useState<'bn-BD' | 'bn-IN'>('bn-BD');
  const recRef = useRef<SR | null>(null);
  const finalCb = useRef(onFinal);
  finalCb.current = onFinal;

  const start = useCallback((lang: 'bn-BD' | 'bn-IN' = 'bn-BD') => {
    const Ctor = getSR();
    if (!Ctor) { setError('unsupported'); return; }
    try { recRef.current?.abort(); } catch { /* ignore */ }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false; // Android Chrome duplicates results in continuous mode; tap again to add more
    rec.maxAlternatives = 1;
    let gotFinal = false;
    rec.onresult = (e: any) => {
      let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { gotFinal = true; finalCb.current(r[0].transcript.trim()); }
        else inter += r[0].transcript;
      }
      setInterim(inter);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'language-not-supported' && lang === 'bn-BD') {
        setLangUsed('bn-IN');
        start('bn-IN');
        return;
      }
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('denied');
      else if (e.error !== 'aborted' && e.error !== 'no-speech') setError('failed');
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      if (!gotFinal) setInterim((s) => { if (s.trim()) finalCb.current(s.trim()); return ''; });
      else setInterim('');
    };
    recRef.current = rec;
    setError(null);
    setLangUsed(lang);
    setListening(true);
    try { rec.start(); } catch { setListening(false); setError('failed'); }
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  return { supported, listening, interim, error, langUsed, start: () => start('bn-BD'), stop };
}
