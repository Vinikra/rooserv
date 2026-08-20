import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wallet, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock, 
  Send, 
  CheckCircle, 
  MapPin 
} from 'lucide-react';
import { formatCurrencyBRL } from '@servicos/shared';

interface ProviderDashboardScreenProps {
  onOpenOnboarding?: () => void;
}

export const ProviderDashboardScreen: React.FC<ProviderDashboardScreenProps> = ({
  onOpenOnboarding,
}) => {
  const { requests, orders, providers } = useApp();

  // Seleciona o prestador Carlos como exemplo
  const currentProvider = providers[0];

  // Cálculos da Carteira
  const completedOrders = orders.filter((o) => o.status === 'approved_by_client');
  const escrowOrders = orders.filter(
    (o) => o.status === 'payment_in_escrow' || o.status === 'completed_by_provider'
  );

  const availableBalance = completedOrders.reduce((acc, o) => acc + o.providerPayoutAmount, 540);
  const escrowBalance = escrowOrders.reduce((acc, o) => acc + o.providerPayoutAmount, 0);

  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const [proposalSentId, setProposalSentId] = useState<string | null>(null);

  const handleRequestPayout = () => {
    setPayoutSuccess(true);
    setTimeout(() => setPayoutSuccess(false), 3000);
  };

  const handleSendProposal = (reqId: string) => {
    setProposalSentId(reqId);
    setTimeout(() => setProposalSentId(null), 2500);
  };

  return (
    <div className="pb-28 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Header do Prestador */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-black text-amber-600 uppercase tracking-wider block">
            Painel do Profissional
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
            {currentProvider.profile?.fullName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-amber-300 transition-colors"
            >
              + Novo Cadastro
            </button>
          )}
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verificado</span>
          </div>
        </div>
      </div>

      {/* Cartão da Carteira Digital com Tipografia Grande */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-semibold text-slate-300">Saldo Disponível para Saque</span>
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div>
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            {formatCurrencyBRL(availableBalance)}
          </h3>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Chave Pix cadastrada: <strong className="text-amber-400 font-bold">{currentProvider.pixKey}</strong>
          </p>
        </div>

        {/* Dinheiro Retido em Custódia */}
        <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[11px] uppercase font-extrabold">Retido em Serviços (Custódia)</span>
              <strong className="text-white text-sm sm:text-base font-extrabold">{formatCurrencyBRL(escrowBalance)}</strong>
            </div>
          </div>
          <span className="text-xs text-blue-300 font-bold bg-blue-500/20 px-2.5 py-1 rounded-lg">
            Liberado pós-serviço
          </span>
        </div>

        {/* Botão de Saque Instantâneo via Pix com Altura de 52px */}
        <button
          type="button"
          onClick={handleRequestPayout}
          disabled={availableBalance <= 0}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm sm:text-base py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowUpRight className="w-5 h-5" />
          <span>{`Solicitar Saque Pix (${formatCurrencyBRL(availableBalance)})`}</span>
        </button>

        {payoutSuccess && (
          <div className="bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-xs sm:text-sm p-3.5 rounded-2xl text-center font-bold animate-in fade-in">
            ✓ Saque Pix solicitado com sucesso! O valor foi enviado diretamente para sua chave Pix.
          </div>
        )}
      </div>

      {/* Oportunidades de Serviços na Cidade com Cards Espaçosos */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
            Pedidos Recentes na Cidade ({requests.length})
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Clientes aguardando contato
          </span>
        </div>

        {requests.map((req) => {
          const isSent = proposalSentId === req.id;
          return (
            <div
              key={req.id}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs bg-brand-50 text-brand-700 font-extrabold px-2.5 py-0.5 rounded-full border border-brand-200">
                      {req.category?.name}
                    </span>
                    {req.urgency === 'urgent_today' && (
                      <span className="text-xs bg-red-50 text-red-700 font-extrabold px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Urgente Hoje</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    {req.title}
                  </h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-slate-500 block font-medium">Orçamento Previsto</span>
                  <strong className="text-sm font-black text-slate-900">
                    {req.budgetEstimate ? formatCurrencyBRL(req.budgetEstimate) : 'A combinar'}
                  </strong>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-medium">
                {`"${req.description}"`}
              </p>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>Bairro: <strong className="text-slate-900">{req.addressNeighborhood}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendProposal(req.id)}
                  className={`font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 active:scale-95 ${
                    isSent
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-950 hover:bg-slate-900 text-white shadow-sm'
                  }`}
                >
                  {isSent ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Orçamento Enviado!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Orçamento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
