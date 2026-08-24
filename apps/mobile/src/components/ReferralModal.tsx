import React, { useState } from 'react';
import { X, Gift, Copy, Check, Share2 } from 'lucide-react';

interface ReferralModalProps {
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const shareUrl = `${window.location.origin}/`;
  const shareMessage = `Oi! Conheça o RooServ para contratar profissionais em Rondonópolis: ${shareUrl}`;

  const handleCopy = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(true);
    }
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="referral-title" className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 id="referral-title" className="text-sm font-extrabold text-slate-900">
                Indique um Vizinho em Rondonópolis
              </h3>
              <p className="text-[11px] text-slate-500">
                Compartilhe o acesso ao aplicativo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar indicação"
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de convite */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 p-4 rounded-2xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider bg-black/15 px-2.5 py-0.5 rounded-full inline-block">
            Rede local de serviços
          </span>
          <h4 className="text-sm font-black">
            Ajude um vizinho a encontrar profissionais locais
          </h4>
          <p className="text-xs text-amber-950/80 font-medium leading-tight">
            Compartilhe o link do RooServ por mensagem ou WhatsApp.
          </p>
        </div>

        {/* Link do aplicativo */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700">
            Link do aplicativo:
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-2.5 text-center font-mono font-extrabold text-slate-900 text-sm tracking-wider">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs p-3 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          {copyError && (
            <p role="alert" className="text-xs text-red-700 font-semibold">
              Não foi possível copiar automaticamente. Selecione o link acima e copie manualmente.
            </p>
          )}
        </div>

        {/* Botão de Compartilhar no WhatsApp */}
        <button
          type="button"
          onClick={handleWhatsAppShare}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          <span>Enviar para Vizinhos no WhatsApp</span>
        </button>
      </div>
    </div>
  );
};
