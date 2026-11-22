import { useEffect, useState } from 'react';
import { api, API_URL_KEY, configuredApiUrl, isDemo } from '../api';
import { setSimulatedOffline, simulatedOffline } from '../api/outbox';
import { useI18n } from '../i18n/I18n';

interface BIPEvent extends Event { prompt: () => Promise<void> }
let deferred: BIPEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; });
}

export default function AboutScreen() {
  const { t, lang, setLang } = useI18n();
  const [sim, setSim] = useState(simulatedOffline());
  const [url, setUrl] = useState(configuredApiUrl());
  const [note, setNote] = useState('');
  const [canInstall, setCanInstall] = useState(!!deferred);
  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  return (
    <section className="screen">
      <h1 className="h1">{t('aboutTitle')}</h1>
      <p>{t('aboutBody')}</p>
      <div className={`note ${isDemo ? 'note-warn' : 'note-info'}`}>{isDemo ? t('demoNotice') : `${t('liveNotice')}: ${configuredApiUrl()}`}</div>

      <div className="card">
        <label className="label">{t('language')}</label>
        <div className="seg">
          <button className={`btn ${lang === 'bn' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang('bn')}>বাংলা</button>
          <button className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang('en')}>English</button>
        </div>
      </div>

      <div className="card">
        <button className="btn btn-primary btn-block" onClick={async () => {
          if (deferred) { await deferred.prompt(); deferred = null; setCanInstall(false); } else setNote(t('installHint'));
        }}>📲 {t('install')}</button>
        {!canInstall && <div className="muted small">{t('installHint')}</div>}
      </div>

      <div className="card">
        <label className="toggle">
          <input type="checkbox" checked={sim} onChange={(e) => { setSim(e.target.checked); setSimulatedOffline(e.target.checked); }} />
          <span>{t('simulateOffline')}</span>
        </label>
        {api.resetDemo && (
          <button className="btn btn-ghost btn-block" onClick={async () => { await api.resetDemo!(); setNote(t('resetDone')); }}>
            ♻️ {t('resetDemo')}
          </button>
        )}
      </div>

      <div className="card">
        <label className="label" htmlFor="api-url">{t('backendUrl')}</label>
        <input id="api-url" className="input" type="url" inputMode="url" placeholder="https://pani-shakkhi-api.onrender.com"
          value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="muted small">{t('backendHint')}</div>
        <button className="btn btn-ghost btn-block" onClick={() => {
          if (url.trim()) localStorage.setItem(API_URL_KEY, url.trim()); else localStorage.removeItem(API_URL_KEY);
          location.reload();
        }}>{t('save')}</button>
      </div>

      {note && <div className="note note-ok" role="status">{note}</div>}
      <p className="muted small center">v1.0 · Noto Sans Bengali · OpenStreetMap © contributors</p>
    </section>
  );
}
