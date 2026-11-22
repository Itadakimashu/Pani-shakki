import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18n';

const items = [
  { to: '/', icon: '🎙️', key: 'navReport' },
  { to: '/alerts', icon: '🔔', key: 'navAlerts' },
  { to: '/dashboard', icon: '🗺️', key: 'navDashboard' },
  { to: '/about', icon: '☰', key: 'navAbout' },
] as const;

export default function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon" aria-hidden>{it.icon}</span>
          <span>{t(it.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
