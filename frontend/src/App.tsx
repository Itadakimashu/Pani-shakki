import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/I18n';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ReportScreen from './screens/ReportScreen';
import AlertsScreen from './screens/AlertsScreen';
import AboutScreen from './screens/AboutScreen';

// Leaflet is heavy — load the dashboard only when a responder opens it (keeps first load small on 3G).
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));

function Loading() {
  const { t } = useI18n();
  return <p className="muted center pad">{t('loading')}</p>;
}

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Header />
        <main className="main">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<ReportScreen />} />
              <Route path="/alerts" element={<AlertsScreen />} />
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/about" element={<AboutScreen />} />
              <Route path="*" element={<ReportScreen />} />
            </Routes>
          </Suspense>
        </main>
        <BottomNav />
      </HashRouter>
    </I18nProvider>
  );
}
