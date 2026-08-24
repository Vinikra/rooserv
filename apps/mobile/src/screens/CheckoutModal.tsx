import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  ProviderProfile, 
  Order,
  CITY_CONFIG, 
  AbacatePayPixQrCodeResponse,
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
import type { PixGatewayStatus } from '../services/paymentService';

interface CheckoutModalProps {
  provider: ProviderProfile | null;
  existingOrder: Order;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  provider,
  existingOrder,
  onClose,
  onSuccess,
}) => {
  const serviceAmount = existingOrder.totalAmount;
  const paymentMethod = 'pix' as const;
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<AbacatePayPixQrCodeResponse | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutos
  const [gatewayStatus, setGatewayStatus] = useState<PixGatewayStatus>('PENDING');
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const checkInFlightRef = useRef(false);

  const checkPaymentStatus = useCallback(async (silent = false) => {
    if (checkInFlightRef.current) return;
    checkInFlightRef.current = true;
    if (!silent) setIsCheckingPayment(true);
    if (!silent) setPixError(null);

    try {
      const result = await RooServPaymentService.checkPixPayment(existingOrder.id);
      if (!result.success || !result.gatewayStatus) {
        if (!silent) setPixError(result.error || 'Não foi possível consultar o pagamento.');
        return;
      }

      setGatewayStatus(result.gatewayStatus);
      setIsDevMode(result.devMode === true);
      if (result.expiresAt) {
        setPixData((current) => current && current.expirationDate !== result.expiresAt
          ? { ...current, expirationDate: result.expiresAt! }
          : current);
      }
      if (result.gatewayStatus === 'EXPIRED' || result.gatewayStatus === 'CANCELLED') {
        setTimeLeft(0);
      }
      if (result.confirmed) {
        setGatewayStatus('PAID');
        setIsPaymentConfirmed(true);
        setPixError(null);
      }
    } catch {
      if (!silent) setPixError('Não foi possível consultar o pagamento agora. Tente novamente.');
    } finally {
      checkInFlightRef.current = false;
      if (!silent) setIsCheckingPayment(false);
    }
  }, [existingOrder.id]);

  // Deriva o tempo da expiração retornada pelo gateway, evitando deriva e
  // recriação de intervalos a cada segundo.
  useEffect(() => {
    if (!pixData?.expirationDate) return;
    const expiresAt = new Date(pixData.expirationDate).getTime();
    const updateCountdown = () => {
      setTimeLeft(Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pixData]);

  // Webhooks são a fonte autoritativa; esta consulta periódica é apenas um
  // fallback de UX enquanto o modal está aberto.
  useEffect(() => {
    if (!pixData || isPaymentConfirmed) return;

    const isExpired = () => new Date(pixData.expirationDate).getTime() <= Date.now();
    const poll = () => {
      if (!isExpired()) void checkPaymentStatus(true);
    };
    poll();
    const interval = window.setInterval(poll, 5_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkPaymentStatus, isPaymentConfirmed, pixData]);

  if (!provider) return null;

  // Decomposição do valor Pix fixado na proposta aceita.
  const pricing = calculateCheckoutPricing({
    serviceAmount,
    paymentMethod,
    installments: 1,
  });

  const handleCopyPix = async () => {
    if (pixData) {
      try {
        await navigator.clipboard.writeText(pixData.payload);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch {
        setPixError('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.');
      }
    }
  };

  const handleConfirmPayment = async () => {
    if (isPaymentConfirmed) {
      onSuccess();
      return;
    }

    if (pixData && (gatewayStatus === 'PAID' || timeLeft > 0)) {
      await checkPaymentStatus(false);
      return;
    }

    if (pixData && timeLeft <= 0) {
      setPixData(null);
      setGatewayStatus('PENDING');
      setIsPaymentConfirmed(false);
    }

    if (!Number.isFinite(serviceAmount) || serviceAmount < 30 || serviceAmount > 100000) {
      setPixError('Informe um valor do serviço entre R$ 30 e R$ 100.000.');
      return;
    }

    setIsProcessing(true);
    setPixLoading(true);
    setPixError(null);
    try {
      const result = await RooServPaymentService.initiatePixCheckout({ id: existingOrder.id });
      if (!result.success || !result.pixQrCode) {
        throw new Error(result.error || 'Não foi possível gerar a cobrança Pix.');
      }

      setPixData({ ...result.pixQrCode, success: true });
      setGatewayStatus(result.gatewayStatus || 'PENDING');
      setIsDevMode(result.devMode === true);
      const expiresAt = new Date(result.pixQrCode.expirationDate).getTime();
      setTimeLeft(Number.isFinite(expiresAt)
        ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
        : 900);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.');
    } finally {
      setPixLoading(false);
      setIsProcessing(false);
    }
  };

  const handleSandboxSimulation = async () => {
    setIsSimulatingPayment(true);
    setPixError(null);
    try {
      const result = await RooServPaymentService.simulateSandboxPixPayment(existingOrder.id);
      if (!result.success || result.devMode !== true || result.gatewayStatus !== 'PAID' || result.reconciled !== true) {
        throw new Error(result.error || 'A simulação sandbox não foi confirmada.');
      }
      setGatewayStatus('PAID');
      setIsPaymentConfirmed(true);
      setPixError(null);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : 'Não foi possível simular o pagamento.');
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header com Banner de Segurança */}
        <div className="bg-slate-900 text-white p-5 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar pagamento"
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Pagamento RooServ • Taxa da plataforma 12%</span>
          </div>

          <h3 id="checkout-title" className="text-base sm:text-lg font-black leading-tight">
            {`Pagamento do pedido ${existingOrder.orderNumber}`}
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

            <p className="text-xs text-slate-500 font-medium">
              Valor fixado pela proposta aceita. O pagamento será vinculado a este contrato.
            </p>

            {/* Repartição registrada pela plataforma (12% / 88%) */}
            <div className="pt-2.5 border-t border-slate-200 text-xs text-slate-600 space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span>Repasse ao Profissional (88%):</span>
                <strong className="text-slate-900 font-extrabold">{formatCurrencyBRL(pricing.providerPayoutAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Taxa da Plataforma (12%):</span>
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

          {/* Área do Pix com AbacatePay */}
          {paymentMethod === 'pix' && pixData && timeLeft > 0 && gatewayStatus === 'PENDING' && (
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
                  alt="QR Code Pix AbacatePay"
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
                    aria-label="Código Pix copia e cola"
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
                <span>Aguardando confirmação de pagamento via AbacatePay...</span>
              </div>

              {isDevMode && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2 text-violet-950">
                  <p className="text-xs font-semibold">
                    Ambiente sandbox: esta cobrança não movimenta dinheiro real.
                  </p>
                  <button
                    type="button"
                    onClick={handleSandboxSimulation}
                    disabled={isSimulatingPayment || isCheckingPayment}
                    className="w-full bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white rounded-xl py-2.5 px-3 text-xs font-black"
                  >
                    {isSimulatingPayment ? 'Simulando pagamento…' : 'Simular pagamento aprovado'}
                  </button>
                </div>
              )}
            </div>
          )}

          {pixData && gatewayStatus === 'PAID' && !isPaymentConfirmed && (
            <div role="status" aria-live="polite" className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-950 text-xs font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              Pagamento detectado pela AbacatePay. Aguardando a conciliação segura do webhook antes de liberar o pedido.
            </div>
          )}

          {pixData && isPaymentConfirmed && (
            <div role="status" aria-live="polite" className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-emerald-950 text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              Pagamento confirmado e registrado no pedido.
            </div>
          )}

          {pixData && (timeLeft <= 0 || gatewayStatus === 'EXPIRED' || gatewayStatus === 'CANCELLED') && (
            <div role="status" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-950 text-xs font-semibold">
              Esta cobrança Pix expirou. Gere um novo QR Code para o mesmo pedido; nenhum pedido duplicado será criado.
            </div>
          )}

          {/* Explicação do fluxo de pagamento e repasse */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-950 leading-relaxed font-medium">
              <strong>Fluxo de repasse:</strong> o pagamento permanece registrado e o repasse de <strong>{formatCurrencyBRL(pricing.providerPayoutAmount)}</strong> ao profissional ocorre após sua aprovação ou a resolução de uma disputa.
            </p>
          </div>
        </div>

        {/* Botão de Confirmação */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={isProcessing || pixLoading || isCheckingPayment || isSimulatingPayment || (!pixData && (serviceAmount < 30 || serviceAmount > 100000))}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isProcessing || isCheckingPayment ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{isCheckingPayment ? 'Verificando pagamento…' : 'Criando cobrança segura na AbacatePay...'}</span>
              </span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {pixData
                    ? (isPaymentConfirmed
                        ? 'Continuar para o pedido'
                        : gatewayStatus === 'PAID'
                          ? 'Atualizar conciliação'
                          : timeLeft > 0
                            ? 'Verificar pagamento agora'
                            : 'Gerar novo QR Code Pix')
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
