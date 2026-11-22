/** speechSynthesis wrapper that prefers an installed Bangla voice. */
import { useCallback, useEffect, useState } from 'react';

export function useSpeechSynthesis() {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => synth?.getVoices() ?? []);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!synth) return;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener?.('voiceschanged', load);
    const t = setTimeout(load, 1500);
    return () => { synth.removeEventListener?.('voiceschanged', load); clearTimeout(t); synth.cancel(); };
  }, [synth]);

  const bnVoice = voices.find((v) => /^bn([-_]|$)/i.test(v.lang)) ?? voices.find((v) => /bengali|bangla|বাংলা/i.test(v.name));
  const enVoice = voices.find((v) => /^en([-_]|$)/i.test(v.lang));

  const speak = useCallback((text: string, lang: 'bn' | 'en') => {
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = lang === 'bn' ? bnVoice : enVoice;
    u.lang = v?.lang ?? (lang === 'bn' ? 'bn-BD' : 'en-US');
    if (v) u.voice = v;
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, [synth, bnVoice, enVoice]);

  const stop = useCallback(() => { synth?.cancel(); setSpeaking(false); }, [synth]);

  return {
    supported: !!synth,
    // voices may legitimately be empty for a moment on Android; only warn once the list has loaded
    hasBangla: !!bnVoice,
    voicesLoaded: voices.length > 0,
    speaking, speak, stop,
  };
}
