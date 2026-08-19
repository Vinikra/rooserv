import React, { useState } from 'react';
import { ProviderProfile } from '@servicos/shared';
import { useApp } from '../context/AppContext';
import { 
  X, 
  ShieldCheck, 
  QrCode, 
  CreditCard, 
  Check, 
  Copy, 
  Lock, 
  Sparkles, 
  ArrowRight, 
  Building2 
} from 'lucide-react';
import { 
  calculateServiceSplit, 
  calculateInstallments, 
  formatCurrencyBRL 
} from '@servicos/shared';

interface CheckoutModalProps {
  provider: ProviderProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  provider,
  onClose,
  onSuccess,
}) => {
  const { hireProviderWithEscrow } = useApp();
  
  const [serviceAmount, setServiceAmount] = useState<number>(250);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [selectedInstallment, setSelectedInstallment] = useState<number>(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!provider) return null;

  const split = calculateServiceSplit(serviceAmount, 12.0);
  const installmentOptions = calculateInstallments(serviceAmount, 12, 3);

  const handleCopyPix = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      hireProviderWithEscrow({
        providerId: provider.id,
        amount: serviceAmount,
        paymentMethod,
        installments: paymentMethod === 'credit_card' ? selectedInstallment : 1,
      });
      setIsProcessing(false);
      onSuccess();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header com Banner de Segurança */}
        <div className="bg-slate-900 text-white p-4 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Pagamento 100% Protegido em Custódia</span>
          </div>

          <h3 className="text-base font-bold">
            Contratação: {provider.profile?.fullName}
          </h3>
          <p className="text-xs text-slate-400">
            {provider.profile?.neighborhood} • Cidade Modelo-SP
          </p>
        </div>

        {/* Corpo com Configuração do Pagamento */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          
          {/* Valor do Serviço */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Valor Combinado do Serviço</span>
              <span className="text-base font-black text-slate-900">
                {formatCurrencyBRL(serviceAmount)}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              {[150, 250, 450, 800].map((val) => (
                <button
                  key={val}
                  onClick={() => setServiceAmount(val)}
                  className={`flex-1 py-1 rounded-lg font-semibold text-[11px] border transition-all ${
                    serviceAmount === val
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>

            {/* Explicação da Divisão do Split (Regra dos 12%) */}
            <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Repasse ao Prestador (88% após aprovação):</span>
                <strong className="text-slate-800">{formatCurrencyBRL(split.providerPayoutAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Taxa de Segurança da Plataforma (12%):</span>
                <strong className="text-emerald-700 font-semibold">{formatCurrencyBRL(split.platformFeeAmount)}</strong>
              </div>
            </div>
          </div>

          {/* Método de Pagamento */}
          <div>
            <label className="font-bold text-slate-900 block mb-2">
              Escolha como pagar:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 font-semibold text-xs transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block leading-tight">Pix Instantâneo</span>
                  <span className="text-[10px] text-emerald-600 font-normal">Aprovação na hora</span>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 font-semibold text-xs transition-all ${
                  paymentMethod === 'credit_card'
                    ? 'border-brand-500 bg-brand-50/50 text-brand-950 ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block leading-tight">Cartão de Crédito</span>
                  <span className="text-[10px] text-brand-600 font-normal">Até 12x</span>
                </div>
              </button>
            </div>
          </div>

          {/* Área do Pix */}
          {paymentMethod === 'pix' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
              <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=00020101021226580014BR.GOV.BCB.PIX2536servicos-hiperlocal-cidade-modelo520400005303986540${serviceAmount}.005802BR5925SERVICOS%20JA%20PLATAFORMA6014CIDADE%20MODELO62070503***6304`}
                  alt="QR Code Pix"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-center">
                <span className="text-[11px] text-slate-500 block">
                  Código Pix Copia e Cola da Custódia:
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={`00020126580014BR.GOV.BCB.PIX2536servicos-ja-${split.totalAmount}-custodia`}
                    className="w-full bg-white border border-slate-200 text-[10px] px-2.5 py-1.5 rounded-lg text-slate-600 font-mono select-all"
                  />
                  <button
                    onClick={handleCopyPix}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg text-xs font-semibold shrink-0 transition-colors"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Área do Cartão (Parcelamento) */}
          {paymentMethod === 'credit_card' && (
            <div className="space-y-2">
              <label className="font-bold text-slate-900 block text-[11px]">
                Selecione as Parcelas:
              </label>
              <select
                value={selectedInstallment}
                onChange={(e) => setSelectedInstallment(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 text-xs rounded-xl p-2.5 font-medium focus:outline-none focus:border-brand-500"
              >
                {installmentOptions.map((opt) => (
                  <option key={opt.installments} value={opt.installments}>
                    {opt.installments}x de {formatCurrencyBRL(opt.installmentAmount)}{' '}
                    {opt.hasInterest ? `(Total ${formatCurrencyBRL(opt.totalWithInterest)})` : 'sem juros'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Aviso de Garantia */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-tight">
              <strong>Como funciona a liberação:</strong> O valor pago fica bloqueado na plataforma. O profissional só recebe os <strong>{formatCurrencyBRL(split.providerPayoutAmount)}</strong> quando você confirmar que o serviço foi finalizado com perfeição.
            </p>
          </div>
        </div>

        {/* Botão de Confirmação */}
        <div className="p-4 bg-white border-t border-slate-200">
          <button
            onClick={handleConfirmPayment}
            disabled={isProcessing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Confirmando pagamento em custódia...</span>
            ) : (
              <>
                <span>Simular Pagamento Seguro ({formatCurrencyBRL(serviceAmount)})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
