/// <reference types="vite-plugin-pwa/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker e lida com atualizações automáticas
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('rooserv:pwa-update', {
      detail: { update: () => updateSW(true) },
    }));
  },
  onOfflineReady() {
    console.log('[PWA] Pronto para funcionar offline');
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
