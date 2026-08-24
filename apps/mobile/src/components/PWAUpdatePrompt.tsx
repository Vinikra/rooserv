import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface PWAUpdateEventDetail {
  update: () => Promise<void>;
}

export const PWAUpdatePrompt: React.FC = () => {
  const updateRef = useRef<(() => Promise<void>) | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PWAUpdateEventDetail>).detail;
      if (!detail?.update) return;
      updateRef.current = detail.update;
      setIsVisible(true);
    };

    window.addEventListener('rooserv:pwa-update', handleUpdate);
    return () => window.removeEventListener('rooserv:pwa-update', handleUpdate);
  }, []);

  const applyUpdate = async () => {
    if (!updateRef.current) return;
    setIsUpdating(true);
    try {
      await updateRef.current();
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-brand-300 bg-white p-4 shadow-2xl md:bottom-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-brand-50 p-2.5 text-brand-700">
          <RefreshCw className={`h-5 w-5 ${isUpdating ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Uma nova versão do RooServ está pronta</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Atualize para receber as melhorias sem perder seus dados.</p>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            disabled={isUpdating}
            className="mt-3 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isUpdating ? 'Atualizando…' : 'Atualizar agora'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          disabled={isUpdating}
          aria-label="Dispensar atualização por enquanto"
          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
