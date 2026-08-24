import React from 'react';
import { X, ShieldCheck, FileText, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { CITY_CONFIG, LEGAL_TERMS_VERSION } from '@servicos/shared';

interface TermsModalProps {
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="bg-white w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col space-y-3.5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="terms-title" className="text-sm font-bold text-slate-900">
                Termos de Uso RooServ
              </h3>
              <p className="text-[11px] text-slate-500">
                Resumo v{LEGAL_TERMS_VERSION} • {CITY_CONFIG.name} - {CITY_CONFIG.state}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar termos"
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs text-slate-600 leading-relaxed">
          <div className="bg-brand-50/60 p-3 rounded-2xl border border-brand-200 text-brand-950 font-medium">
            🛡️ <strong>Fluxo de pagamento e repasse:</strong>
            <p className="mt-1 text-slate-700">
              O pagamento confirmado via Pix fica registrado na plataforma, e o repasse ao prestador ocorre depois da aprovação do cliente ou da resolução de uma disputa. Esse fluxo não deve ser interpretado como conta bancária, depósito ou seguro oferecido ao usuário.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-600" />
              1. Política Anti-Vazamento e Segurança
            </h4>
            <p>
              Para preservar o histórico da contratação, tratativas de preço e orçamentos devem ocorrer dentro do Chat do RooServ. Negociações externas não ficam registradas e podem limitar a análise de suporte, disputa ou reembolso.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              2. Cobertura do Serviço
            </h4>
            <p>
              O prazo e as condições de eventual retrabalho devem constar na proposta aceita e nos Termos de Uso vigentes. O selo verificado confirma a análise cadastral; ele não substitui as obrigações combinadas entre cliente e prestador.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              3. Resolução de Disputas & Mediação
            </h4>
            <p>
              Caso o prestador não compareça ou haja desacordo na entrega, o morador pode usar “Reportar Problema”. A equipe analisará as evidências e decidirá a providência cabível, inclusive eventual estorno, conforme os termos e o estado do pagamento.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
              4. Privacidade e LGPD
            </h4>
            <p>
              Documentos de identidade ficam em armazenamento privado com acesso temporário e restrito à equipe autorizada. Os dados são usados para cadastro, prevenção a fraude, pagamento e cumprimento de obrigações legais.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-950">
            Este é um resumo operacional. Antes do lançamento comercial, os textos integrais de Termos de Uso, Política de Privacidade, prazos de retenção e canal do titular devem ser revisados por assessoria jurídica.
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors"
        >
          Fechar resumo
        </button>
      </div>
    </div>
  );
};
