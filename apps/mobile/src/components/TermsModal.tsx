import React from 'react';
import { X, ShieldCheck, FileText, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { CITY_CONFIG } from '@servicos/shared';

interface TermsModalProps {
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col space-y-3.5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Termos de Uso & Garantia RooServ
              </h3>
              <p className="text-[11px] text-slate-500">
                Regulamento Oficial • {CITY_CONFIG.name} - {CITY_CONFIG.state}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs text-slate-600 leading-relaxed">
          <div className="bg-brand-50/60 p-3 rounded-2xl border border-brand-200 text-brand-950 font-medium">
            🛡️ <strong>Garantia de Pagamento Seguro (Custódia):</strong>
            <p className="mt-1 text-slate-700">
              O valor pago pelo contratante via Pix ou Cartão de Crédito permanece 100% sob custódia da plataforma até que o serviço seja inspecionado, aprovado e avaliado pelo morador no aplicativo.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-600" />
              1. Política Anti-Vazamento e Segurança
            </h4>
            <p>
              Para a proteção física dos moradores e garantia contra prejuízos financeiros, todas as tratativas de preço e orçamentos devem ocorrer exclusivamente dentro do Chat do RooServ. Negociações realizadas por fora anulam qualquer direito a seguro, suporte ou reembolso.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              2. Garantia de 60 Dias no Serviço
            </h4>
            <p>
              Prestadores com Selo Verificado oferecem garantia padrão de 60 dias para retrabalho sem custo adicional em caso de defeito na execução da mão de obra.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              3. Resolução de Disputas & Mediação
            </h4>
            <p>
              Caso o prestador não compareça ao endereço em Rondonópolis ou haja desacordo na entrega, o morador pode acionar o botão "Reportar Problema" para que a equipe de moderação analise as evidências e processe o estorno integral do pagamento.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
              4. Privacidade e LGPD
            </h4>
            <p>
              Seus documentos pessoais (RG/CNH e CPF) são criptografados e utilizados única e exclusivamente para a validação cadastral e combate a fraudes na cidade de Rondonópolis.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors"
        >
          Li e Concordo com os Termos
        </button>
      </div>
    </div>
  );
};
