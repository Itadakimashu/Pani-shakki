import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n/I18n';
import { useAsync } from '../hooks/useAsync';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import UnionSelect from '../components/UnionSelect';
import Sparkline from '../components/Sparkline';
import type { Alert, StationForecast } from '../lib/types';

function StationCard({ f, highlight }: { f: StationForecast; highlight?: boolean }) {
  const { t, n, lang } = useI18n();
  const above = f.current_m >= f.danger_m;
  const diff = f.current_m - f.danger_m;
  const arrow = f.trend === 'rising' ? '↑' : f.trend === 'falling' ? '↓' : '→';
  const m = (x: number) => `${n(x.toFixed(2))} ${lang === 'bn' ? 'মি' : 'm'}`;
  const signed = (x: number) => `${x >= 0 ? '+' : '−'}${n(Math.abs(x).toFixed(2))} ${lang === 'bn' ? 'মি' : 'm'}`;
  return (
    <div className={`card station${highlight ? ' station-hl' : ''}`}>
      <div className="row-between">
        <div>
          <strong>{lang === 'bn' ? f.station.river_bn : f.station.river_en}</strong>
          <span className="muted"> · {lang === 'bn' ? f.station.name_bn : f.station.name_en}</span>
        </div>
        <span className={`chip trend-${f.trend}`}>{arrow} {t(f.trend)}</span>
      </div>
      <div className="stats">
        <div><div className="muted small">{t('current')}</div><div className="stat">{m(f.current_m)}</div></div>
        <div><div className="muted small">{t('danger')}</div><div className="stat">{m(f.danger_m)}</div></div>
        <div><div className="muted small">{t('in24h')}</div><div className="stat">{signed(f.delta_24h_m)}</div></div>
      </div>
      <Sparkline readings={f.readings} danger={f.danger_m} label={`${f.station.river_en} 72h`} />
      <div className={`small ${above ? 'text-danger' : 'muted'}`}>
        {above ? `⚠ ${t('aboveDanger')} (${signed(diff)})` : `${signed(diff)} ${t('belowDanger')}`}
      </div>
    </div>
  );
}

function AlertCard({ a }: { a: Alert }) {
  const { t, lang, clock } = useI18n();
  const tts = useSpeechSynthesis();
  const text = lang === 'bn' ? a.text_bn : a.text_en;
  const title = lang === 'bn' ? a.title_bn : a.title_en;
  const showNoBn = lang === 'bn' && tts.supported && tts.voicesLoaded && !tts.hasBangla;
  return (
    <div className={`card alert alert-${a.level}`}>
      <div className="alert-title">{['ℹ️', '⚠️', '🌊', '🚨'][a.level]} {title}</div>
      <p className="alert-text" lang={lang}>{text}</p>
      <button
        className="btn btn-primary btn-block btn-lg"
        onClick={() => (tts.speaking ? tts.stop() : tts.speak(text, lang))}
        disabled={!tts.supported}
      >
        {tts.speaking ? `⏹ ${t('stop')}` : `🔊 ${t('listen')}`}
      </button>
      {!tts.supported && <div className="note note-warn">{t('noTts')}</div>}
      {showNoBn && <div className="note note-warn">{t('noBnVoice')}</div>}
      <div className="muted small">{t('validUntil')}: {clock(a.valid_until)} · {a.source === 'mock' ? t('mockSource') : a.source}</div>
    </div>
  );
}

export default function AlertsScreen() {
  const { t } = useI18n();
  const [unionId, setUnionId] = useState<string>(() => localStorage.getItem('ps_union') ?? '');
  const unions = useAsync(() => api.listUnions(), []);
  useEffect(() => {
    if (!unionId && unions.data?.length) setUnionId(unions.data[0].id);
  }, [unions.data, unionId]);
  useEffect(() => { if (unionId) localStorage.setItem('ps_union', unionId); }, [unionId]);

  const alerts = useAsync(() => (unionId ? api.getAlerts(unionId) : Promise.resolve([])), [unionId]);
  const all = useAsync(() => api.getForecasts(), []);
  const union = unions.data?.find((u) => u.id === unionId);
  const mine = all.data?.find((f) => f.station.id === union?.station_id);
  const others = all.data?.filter((f) => f.station.id !== union?.station_id) ?? [];

  return (
    <section className="screen">
      <h1 className="h1">{t('alertsTitle')}</h1>
      {unions.data && <UnionSelect unions={unions.data} value={unionId} onChange={setUnionId} />}
      {alerts.loading && <p className="muted">{t('loading')}</p>}
      {alerts.error && <div className="note note-err">{String(alerts.error)}</div>}
      {alerts.data?.map((a) => <AlertCard key={a.id} a={a} />)}

      <h2 className="h2">{t('forecastFeed')}</h2>
      {mine && <StationCard f={mine} highlight />}
      <details className="more">
        <summary>{t('allStations')} ({others.length})</summary>
        {others.map((f) => <StationCard key={f.station.id} f={f} />)}
      </details>
    </section>
  );
}
