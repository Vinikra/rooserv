/// <reference types="vite-plugin-pwa/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { notifyPwaUpdateAvailable } from './lib/pwaUpdate';

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

// Atualizações são aplicadas somente com confirmação para não recarregar um
// checkout, upload ou formulário financeiro no meio de uma ação do usuário.
const updateSW = registerSW({
  onNeedRefresh() {
    notifyPwaUpdateAvailable(() => updateSW(true));
  },
  onOfflineReady() {
    console.log('[PWA] Pronto para funcionar offline');
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine) void registration.update();
    };

    window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
