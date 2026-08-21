import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ProviderProfile, 
  CITY_CONFIG, 
  AsaasPixQrCodeResponse,
  calculateCheckoutPricing,
  formatCurrencyBRL 
} from '@servicos/shared';
import { 
  X, 
  ShieldCheck, 
  QrCode, 
  Check, 
  Copy, 
  Lock, 
  Clock, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';
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
  const paymentMethod = 'pix' as const;
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<AsaasPixQrCodeResponse | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutos

  // Contador regressivo de 15 minutos
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  if (!provider) return null;

  // Cálculo da precificação com repasse de taxas de cartão ao pagador
  const pricing = calculateCheckoutPricing({
    serviceAmount,
    paymentMethod,
    installments: 1,
  });

  const handleCopyPix = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.payload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleConfirmPayment = async () => {
    if (pixData) {
      onSuccess();
      return;
    }

    setIsProcessing(true);
    setPixLoading(true);
    setPixError(null);
    try {
      let orderId = pendingOrderId;
      if (!orderId) {
        const order = await hireProviderWithEscrow({
          providerId: provider.id,
          amount: pricing.serviceBaseAmount,
          paymentMethod,
          installments: 1,
        });
        orderId = order.id;
        setPendingOrderId(order.id);
      }

      const result = await RooServPaymentService.initiatePixCheckout({ id: orderId });
      if (!result.success || !result.pixQrCode) {
        throw new Error(result.error || 'Não foi possível gerar a cobrança Pix.');
      }

      setPixData({ ...result.pixQrCode, success: true });
      setTimeLeft(900);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.');
    } finally {
      setPixLoading(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header com Banner de Segurança */}
        <div className="bg-slate-900 text-white p-5 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Custódia Segura RooServ • Split 12%</span>
          </div>

          <h3 className="text-base sm:text-lg font-black leading-tight">
            Contratação: {provider.profile?.fullName}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {`${provider.profile?.neighborhood} • ${CITY_CONFIG.name} - ${CITY_CONFIG.state}`}
          </p>
        </div>

        {/* Corpo com Configuração do Pagamento */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 flex-1">
          
          {/* Valor do Serviço */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-800 text-sm">Valor do Serviço</span>
              <span className="text-lg sm:text-xl font-black text-slate-900">
                {formatCurrencyBRL(serviceAmount)}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              {[150, 220, 350, 600, 1200].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setServiceAmount(val)}
                  disabled={pendingOrderId !== null}
                  className={`flex-1 py-2 rounded-xl font-black text-xs border transition-all active:scale-95 ${
                    serviceAmount === val
                      ? 'bg-brand-600 border-brand-600 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {`R$ ${val}`}
                </button>
              ))}
            </div>

            {/* Repartição 100% Protegida (12% Plataforma / 88% Prestador) */}
            <div className="pt-2.5 border-t border-slate-200 text-xs text-slate-600 space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span>Repasse ao Profissional (88%):</span>
                <strong className="text-slate-900 font-extrabold">{formatCurrencyBRL(pricing.providerPayoutAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Taxa de Proteção RooServ (12%):</span>
                <strong className="text-emerald-700 font-extrabold">{formatCurrencyBRL(pricing.platformFeeAmount)}</strong>
              </div>
            </div>
          </div>

          {/* Método de pagamento disponível */}
          <div>
            <p className="font-extrabold text-slate-900 text-sm block mb-2">Forma de pagamento:</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-4 rounded-2xl border border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/30 shadow-sm flex items-center gap-3 font-bold text-xs sm:text-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block font-black leading-tight">Pix</span>
                  <span className="text-xs text-emerald-600 font-bold">Sem juros</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 flex items-center text-xs font-bold">
                Cartão indisponível até a integração tokenizada.
              </div>
            </div>
          </div>

          {pixError && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-800 font-medium">
              {pixError}
            </div>
          )}

          {pixLoading && !pixData && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-slate-700 font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Criando pedido e cobrança Pix segura...
            </div>
          )}

          {/* Área do Pix com Asaas Gateway */}
          {paymentMethod === 'pix' && pixData && (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-center space-y-4">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>QR Code Pix Dinâmico</span>
                </span>
                <span className="text-slate-600 font-mono text-xs font-bold flex items-center gap-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>{`Expira em ${RooServPaymentService.formatCountdown(timeLeft)}`}</span>
                </span>
              </div>

              {/* QR Code Imagem */}
              <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border border-slate-200 shadow-md flex items-center justify-center">
                <img
                  src={pixData.encodedImage}
                  alt="QR Code Pix Asaas"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-center space-y-2">
                <span className="text-xs text-slate-600 block font-bold">
                  Ou pague pelo Pix Copia e Cola:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixData.payload}
                    className="w-full bg-white border border-slate-200 text-xs p-3 rounded-xl text-slate-800 font-mono select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-black shrink-0 transition-colors flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900 flex items-center justify-center gap-2 font-medium">
                <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                <span>Aguardando detecção de pagamento via Webhook Asaas...</span>
              </div>
            </div>
          )}

          {/* Aviso de Garantia e Custódia */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-950 leading-relaxed font-medium">
              <strong>Garantia RooServ:</strong> O dinheiro fica bloqueado sob custódia segura. O profissional só recebe os <strong>{formatCurrencyBRL(pricing.providerPayoutAmount)}</strong> após você inspecionar e aprovar o serviço finalizado.
            </p>
          </div>
        </div>

        {/* Botão de Confirmação */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={isProcessing || pixLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Criando cobrança segura no Asaas...</span>
              </span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {pixData
                    ? 'Acompanhar pedido'
                    : `Gerar cobrança Pix (${formatCurrencyBRL(pricing.totalChargedToClient)})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
