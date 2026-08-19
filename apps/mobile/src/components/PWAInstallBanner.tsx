import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare } from 'lucide-react';
import { CITY_CONFIG } from '@servicos/shared';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState<boolean>(false);

  useEffect(() => {
    // Detecta iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    setIsIOS(isIosDevice);

    if (isIosDevice && !isStandalone) {
      const bannerDismissed = localStorage.getItem('rooserv_pwa_dismissed');
      if (!bannerDismissed) {
        setShowBanner(true);
      }
    }

    // Detecta Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const bannerDismissed = localStorage.getItem('rooserv_pwa_dismissed');
      if (!bannerDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      alert('Para instalar: clique nos três pontinhos do navegador e selecione "Instalar Aplicativo" ou "Adicionar à Tela Inicial".');
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('rooserv_pwa_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="bg-slate-900 text-white px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 shadow-lg animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shrink-0 shadow-md">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate leading-tight">
              Instale o RooServ no Celular
            </h4>
            <p className="text-[10px] text-slate-400 truncate">
              Acesso rápido sem ocupar espaço
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal de Instruções para iPhone / iOS */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 text-slate-900 text-center shadow-2xl">
            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Como instalar no iPhone:</h3>
              <p className="text-xs text-slate-600 mt-1">
                Siga estes 2 passos simples no Safari:
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border text-left text-xs space-y-2.5 text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  1
                </span>
                <span>Toque no botão de <strong>Compartilhar</strong> (<Share className="w-3.5 h-3.5 inline text-brand-600" />) na barra inferior do Safari.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  2
                </span>
                <span>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-brand-600" />).</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full bg-brand-600 text-white font-bold text-xs py-2.5 rounded-xl shadow"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
