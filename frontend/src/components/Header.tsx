import { isDemo } from '../api';
import { useI18n } from '../i18n/I18n';
import { useConnectivity } from '../hooks/useConnectivity';

export default function Header() {
  const { t, lang, setLang, n } = useI18n();
  const { online, queued } = useConnectivity();
  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden>💧</span>
        <div>
          <div className="brand-name">{t('appName')}</div>
          <div className="brand-sub">
            <span className={`badge ${isDemo ? 'badge-demo' : 'badge-live'}`}>{isDemo ? t('demo') : t('live')}</span>
            <span className={`dot ${online ? 'dot-on' : 'dot-off'}`} aria-hidden />
            {online ? t('online') : t('offline')}
            {queued > 0 && <span className="badge badge-queue">⏳ {n(queued)}</span>}
          </div>
        </div>
      </div>
      <button className="btn btn-ghost lang-btn" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} aria-label="Language">
        {t('langToggle')}
      </button>
    </header>
  );
}
