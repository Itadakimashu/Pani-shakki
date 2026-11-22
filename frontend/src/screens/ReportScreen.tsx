import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { flush, onOutboxChange, pending, submitReport, type Queued } from '../api/outbox';
import { useI18n } from '../i18n/I18n';
import { QUICK_PHRASES } from '../i18n/strings';
import { classify } from '../lib/classifier/classifier';
import { deviceId, uuid } from '../lib/device';
import { haversineKm } from '../lib/geo';
import type { Report, Shelter, Union } from '../lib/types';
import { useAsync } from '../hooks/useAsync';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { NeedChips, SeverityChip, WaterChip } from '../components/Chips';
import UnionSelect from '../components/UnionSelect';

type Gps = { lat: number; lng: number; acc: number } | null;

export default function ReportScreen() {
  const { t, n, name, ago, pick } = useI18n();
  const [text, setText] = useState('');
  const [gps, setGps] = useState<Gps>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'getting' | 'ok' | 'fail' | 'far'>('idle');
  const [unionId, setUnionId] = useState<string>(() => localStorage.getItem('ps_union') ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const unions = useAsync(() => api.listUnions(), []);
  const mine = useAsync(() => api.listReports().then((rs) => rs.filter((r) => r.device_id === deviceId()).slice(0, 5)), []);

  const appendText = useCallback((s: string) => setText((prev) => (prev.trim() ? `${prev.trim()} ${s}` : s)), []);
  const rec = useSpeechRecognition(appendText);

  const preview = useMemo(() => classify(`${text} ${rec.interim}`), [text, rec.interim]);

  const refreshQueue = useCallback(() => { pending().then(setQueue).catch(() => {}); }, []);
  useEffect(() => {
    refreshQueue();
    return onOutboxChange(() => { refreshQueue(); mine.reload(); });
  }, [refreshQueue, mine.reload]);

  const locate = useCallback((list: Union[]) => {
    if (!('geolocation' in navigator)) { setGpsState('fail'); return; }
    setGpsState('getting');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const g = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        setGps(g);
        const best = list
          .map((u) => ({ u, d: haversineKm(g.lat, g.lng, u.lat, u.lng) }))
          .sort((a, b) => a.d - b.d)[0];
        if (best && best.d <= 50) { setUnionId(best.u.id); setGpsState('ok'); }
        else setGpsState('far');
      },
      () => setGpsState('fail'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 },
    );
  }, []);

  useEffect(() => { if (unions.data && gpsState === 'idle') locate(unions.data); }, [unions.data, gpsState, locate]);
  useEffect(() => { if (unionId) localStorage.setItem('ps_union', unionId); }, [unionId]);

  async function send() {
    setMsg(null);
    setShelter(null);
    if (!text.trim()) { setMsg({ kind: 'err', text: t('needText') }); return; }
    if (!unionId) { setMsg({ kind: 'err', text: t('needUnion') }); return; }
    setBusy(true);
    const useGps = gps && gpsState === 'ok';
    try {
      const res = await submitReport({
        client_id: uuid(), union_id: unionId, text: text.trim(),
        lat: useGps ? Math.round(gps!.lat * 1e5) / 1e5 : null,
        lng: useGps ? Math.round(gps!.lng * 1e5) / 1e5 : null,
        location_source: useGps ? 'gps' : 'manual', device_id: deviceId(), channel: 'app',
        created_at: new Date().toISOString(),
      });
      setMsg({ kind: res === 'sent' ? 'ok' : 'warn', text: res === 'sent' ? t('sent') : t('queued') });
      if (preview.severity >= 2) {
        const u = unions.data?.find((x) => x.id === unionId);
        const lat = useGps ? gps!.lat : u?.lat;
        const lng = useGps ? gps!.lng : u?.lng;
        if (lat != null && lng != null) {
          api.nearestShelters(lat, lng, 1).then((s) => setShelter(s[0] ?? null)).catch(() => {});
        }
      }
      setText('');
      mine.reload();
    } catch (e) {
      setMsg({ kind: 'err', text: String(e) });
    } finally {
      setBusy(false);
    }
  }

  const micLabel = rec.listening ? t('micStop') : t('micStart');
  const hasText = (text + rec.interim).trim().length > 0;

  return (
    <section className="screen">
      <h1 className="h1">{t('reportTitle')}</h1>

      <div className="mic-wrap">
        <button
          type="button"
          className={`mic${rec.listening ? ' mic-on' : ''}`}
          onClick={() => (rec.listening ? rec.stop() : rec.start())}
          disabled={!rec.supported}
          aria-pressed={rec.listening}
          aria-label={micLabel}
        >
          <span aria-hidden>{rec.listening ? '⏹' : '🎙️'}</span>
        </button>
        <div className="mic-label">{rec.supported ? micLabel : t('micUnsupported')}</div>
        {rec.langUsed === 'bn-IN' && <div className="muted small">{t('micLangFallback')}</div>}
        {rec.error === 'denied' && <div className="note note-warn">{t('micDenied')}</div>}
        {rec.error === 'failed' && <div className="note note-warn">{t('micError')}</div>}
      </div>

      <label className="label" htmlFor="report-text">{t('transcript')}</label>
      <div className="textarea-wrap">
        <textarea
          id="report-text"
          className="textarea"
          rows={3}
          value={rec.listening && rec.interim ? `${text} ${rec.interim}`.trim() : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          lang="bn"
        />
        {text && <button className="btn btn-ghost btn-sm clear-btn" onClick={() => setText('')}>{t('clear')}</button>}
      </div>

      <details className="quick">
        <summary>{t('quickPhrases')}</summary>
        <div className="chip-row">
          {QUICK_PHRASES.map((p) => (
            <button key={p.bn} type="button" className="chip chip-btn" onClick={() => appendText(p.bn)}>{pick(p)}</button>
          ))}
        </div>
      </details>

      {hasText && (
        <div className="card card-tight" aria-live="polite">
          <div className="muted small">{t('detected')}</div>
          <div className="chip-row">
            <SeverityChip level={preview.severity} />
            <WaterChip w={preview.water_level} />
            <NeedChips needs={preview.needs} />
          </div>
        </div>
      )}

      <div className="card card-tight">
        <div className="row-between">
          <strong>📍 {t('location')}</strong>
          {gpsState !== 'getting' && unions.data && (
            <button className="btn btn-ghost btn-sm" onClick={() => locate(unions.data!)}>{t('gpsRetry')}</button>
          )}
        </div>
        <div className="small">
          {gpsState === 'getting' && t('gpsGetting')}
          {gpsState === 'ok' && gps && `${t('gpsOk')} · ${n(gps.lat.toFixed(4))}, ${n(gps.lng.toFixed(4))} (±${n(Math.round(gps.acc))} m)`}
          {gpsState === 'fail' && t('gpsFail')}
          {gpsState === 'far' && t('gpsFar')}
        </div>
        <label className="label" htmlFor="union">{t('union')}</label>
        {unions.data && <UnionSelect id="union" unions={unions.data} value={unionId} onChange={setUnionId} />}
      </div>

      <button className="btn btn-primary btn-block btn-lg" onClick={send} disabled={busy}>
        {busy ? t('sending') : `📤 ${t('send')}`}
      </button>

      {msg && <div className={`note note-${msg.kind}`} role="status">{msg.text}</div>}
      {shelter && (
        <div className="note note-info">
          🏠 {t('nearestShelter')}: <strong>{name(shelter)}</strong> · {n(shelter.distance_km ?? 0)} {t('km')}
        </div>
      )}

      {(queue.length > 0 || (mine.data && mine.data.length > 0)) && (
        <div className="card">
          <h2 className="h2">{t('myReports')}</h2>
          {queue.length > 0 && (
            <>
              {queue.map((q) => (
                <div key={q.client_id} className="mini-report">
                  <span className="chip chip-queue">⏳ {t('pendingSync')}</span>
                  <span className="mini-text">{q.text}</span>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => void flush()}>{t('syncNow')}</button>
            </>
          )}
          {mine.data?.map((r: Report) => (
            <div key={r.id} className="mini-report">
              <SeverityChip level={r.severity} />
              <span className="mini-text">{r.text}</span>
              <span className="muted small">{ago(r.created_at)}{r.status === 'responded' ? ` · ${t('responded')}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
