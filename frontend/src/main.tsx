import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans-bengali/bengali-400.css';
import '@fontsource/noto-sans-bengali/bengali-700.css';
import '@fontsource/noto-sans-bengali/latin-400.css';
import '@fontsource/noto-sans-bengali/latin-700.css';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { startAutoSync } from './api/outbox';

registerSW({ immediate: true });
startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
