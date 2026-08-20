import React, { useState, useEffect } from 'react';
import { ProviderProfile, CITY_CONFIG, generateMockPixQrCode, AsaasPixQrCodeResponse } from '@servicos/shared';
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
  Clock, 
  CheckCircle2, 
  RefreshCw,
  Info,
  TrendingDown
} from 'lucide-react';
import { 
  calculateServiceSplit, 
  calculateInstallments, 
  calculateCheckoutPricing,
  formatCurrencyBRL 
} from '@servicos/shared';
import { RooServPaymentService } from '../services/paymentService';

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
  const [pixData, setPixData] = useState<AsaasPixQrCodeResponse | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutos

  // Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  if (!provider) return null;

  // Cálculo da precificação com repasse de taxas de cartão ao pagador
  const pricing = calculateCheckoutPricing({
    serviceAmount,
    paymentMethod,
    installments: selectedInstallment,
  });

  const installmentOptions = calculateInstallments(serviceAmount, 12);

  // Gera código Pix dinâmico com identificador do prestador e valor
  useEffect(() => {
    const orderTempNumber = `SRV-ROO-${Math.floor(1000 + Math.random() * 9000)}`;
    const generated = generateMockPixQrCode(orderTempNumber, serviceAmount);
    setPixData(generated);
    setTimeLeft(900);
  }, [serviceAmount]);

  // Contador regressivo de 15 minutos
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleCopyPix = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.payload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      hireProviderWithEscrow({
        providerId: provider.id,
        amount: pricing.serviceBaseAmount,
        paymentMethod,
        installments: paymentMethod === 'credit_card' ? selectedInstallment : 1,
      });
      setIsProcessing(false);
      onSuccess();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header com Banner de Segurança */}
        <div className="bg-slate-900 text-white p-4 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Custódia Segura RooServ • Split 12%</span>
          </div>

          <h3 className="text-base font-bold">
            Contratação: {provider.profile?.fullName}
          </h3>
          <p className="text-xs text-slate-400">
            {provider.profile?.neighborhood} • {CITY_CONFIG.name} - {CITY_CONFIG.state}
          </p>
        </div>

        {/* Corpo com Configuração do Pagamento */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          
          {/* Valor do Serviço */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Valor Acordado do Serviço</span>
              <span className="text-base font-black text-slate-900">
                {formatCurrencyBRL(serviceAmount)}
              </span>
            </div>

            <div className="flex gap-1.5 pt-1">
              {[150, 220, 350, 600, 1200].map((val) => (
                <button
                  key={val}
                  onClick={() => setServiceAmount(val)}
                  className={`flex-1 py-1 rounded-lg font-bold text-[10px] border transition-all ${
                    serviceAmount === val
                      ? 'bg-brand-600 border-brand-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>

            {/* Repartição 100% Protegida (12% Plataforma / 88% Prestador) */}
            <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Repasse Líquido ao Profissional (88%):</span>
                <strong className="text-slate-900">{formatCurrencyBRL(pricing.providerPayoutAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Taxa de Proteção RooServ (12%):</span>
                <strong className="text-emerald-700 font-semibold">{formatCurrencyBRL(pricing.platformFeeAmount)}</strong>
              </div>
            </div>
          </div>

          {/* Método de Pagamento */}
          <div>
            <label className="font-bold text-slate-900 block mb-2">
              Escolha a forma de pagamento:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPaymentMethod('pix');
                  setSelectedInstallment(1);
                }}
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
                  <span className="text-[10px] text-emerald-600 font-bold">Sem taxas extras</span>
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
                  <span className="text-[10px] text-brand-600 font-normal">Em até 12x</span>
                </div>
              </button>
            </div>
          </div>

          {/* Área do Pix com Asaas Gateway */}
          {paymentMethod === 'pix' && pixData && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  QR Code Pix Dinâmico
                </span>
                <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Expira em {RooServPaymentService.formatCountdown(timeLeft)}
                </span>
              </div>

              {/* QR Code Imagem */}
              <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                <img
                  src={pixData.encodedImage}
                  alt="QR Code Pix Asaas"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-center space-y-1.5">
                <span className="text-[11px] text-slate-500 block font-medium">
                  Ou pague pelo Pix Copia e Cola:
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={pixData.payload}
                    className="w-full bg-white border border-slate-200 text-[10px] px-2.5 py-2 rounded-xl text-slate-700 font-mono select-all truncate"
                  />
                  <button
                    onClick={handleCopyPix}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl text-xs font-bold shrink-0 transition-colors flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2 text-[11px] text-emerald-900 flex items-center justify-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                <span>Aguardando detecção do pagamento via Webhook Asaas...</span>
              </div>
            </div>
          )}

          {/* Área do Cartão de Crédito */}
          {paymentMethod === 'credit_card' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    placeholder="4532 •••• •••• 8821"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nome Impresso no Cartão
                  </label>
                  <input
                    type="text"
                    placeholder="MARIANA SOUZA SILVA"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-brand-500 uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Validade (MM/AA)
                    </label>
                    <input
                      type="text"
                      placeholder="11/29"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      CVV
                    </label>
                    <input
                      type="text"
                      placeholder="352"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Parcelamento no Cartão:
                  </label>
                  <select
                    value={selectedInstallment}
                    onChange={(e) => setSelectedInstallment(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 text-xs rounded-xl p-2.5 font-medium focus:outline-none focus:border-brand-500"
                  >
                    {installmentOptions.map((opt) => (
                      <option key={opt.installments} value={opt.installments}>
                        {opt.installments === 1
                          ? `1x de ${formatCurrencyBRL(opt.installmentAmount)} à vista no cartão`
                          : `${opt.installments}x de ${formatCurrencyBRL(opt.installmentAmount)} (Total ${formatCurrencyBRL(opt.totalWithInterest)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resumo do Acréscimo do Cartão Repassado ao Comprador */}
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-[11px] space-y-1 text-amber-950">
                  <div className="flex justify-between font-semibold">
                    <span>Taxa da operadora de cartão:</span>
                    <span>+{formatCurrencyBRL(pricing.gatewayFeeChargedToBuyer)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-xs text-slate-900 border-t border-amber-200/60 pt-1">
                    <span>Total a pagar no Cartão:</span>
                    <span>{formatCurrencyBRL(pricing.totalChargedToClient)}</span>
                  </div>
                  <p className="text-[10px] text-amber-800 italic pt-0.5">
                    * O custo de processamento do cartão é pago pelo titular, mantendo o repasse integral do prestador e da plataforma.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Aviso de Garantia e Custódia */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-950 leading-tight">
              <strong>Garantia RooServ:</strong> O dinheiro fica bloqueado sob custódia segura. O profissional só recebe os <strong>{formatCurrencyBRL(pricing.providerPayoutAmount)}</strong> após você inspecionar e aprovar o serviço finalizado.
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
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processando custódia segura no Asaas...
              </span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Confirmar Pagamento ({formatCurrencyBRL(pricing.totalChargedToClient)})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
