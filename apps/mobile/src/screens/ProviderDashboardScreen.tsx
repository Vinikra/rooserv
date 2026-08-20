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
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-md mx-auto">
      {/* Header do Prestador */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
            Painel do Profissional
          </span>
          <h2 className="text-sm font-bold text-slate-900">
            {currentProvider.profile?.fullName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-300 transition-colors"
            >
              + Novo Cadastro
            </button>
          )}
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verificado</span>
          </div>
        </div>
      </div>

      {/* Cartão da Carteira Digital */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Saldo Disponível para Saque</span>
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-extrabold tracking-tight">
            {formatCurrencyBRL(availableBalance)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Chave Pix cadastrada: <strong className="text-slate-300">{currentProvider.pixKey}</strong>
          </p>
        </div>

        {/* Dinheiro Retido em Custódia */}
        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Bloqueado em Serviços (Custódia)</span>
              <strong className="text-white text-xs">{formatCurrencyBRL(escrowBalance)}</strong>
            </div>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded">
            Liberado após o cliente aprovar
          </span>
        </div>

        {/* Botão de Saque Instantâneo via Pix */}
        <button
          type="button"
          onClick={handleRequestPayout}
          disabled={availableBalance <= 0}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Solicitar Saque Pix ({formatCurrencyBRL(availableBalance)})</span>
        </button>

        {payoutSuccess && (
          <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs p-2.5 rounded-xl text-center font-medium animate-in fade-in">
            ✓ Saque Pix solicitado com sucesso! Dinheiro enviado para sua conta bancária.
          </div>
        )}
      </div>

      {/* Oportunidades de Serviços na Cidade */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Pedidos Recentes na Cidade ({requests.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Moradores aguardando orçamento
          </span>
        </div>

        {requests.map((req) => {
          const isSent = proposalSentId === req.id;
          return (
            <div
              key={req.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
                      {req.category?.name}
                    </span>
                    {req.urgency === 'urgent_today' && (
                      <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Urgente Hoje
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {req.title}
                  </h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 block">Orçamento Previsto</span>
                  <strong className="text-xs text-slate-900 font-extrabold">
                    {req.budgetEstimate ? formatCurrencyBRL(req.budgetEstimate) : 'A combinar'}
                  </strong>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                "{req.description}"
              </p>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bairro: <strong>{req.addressNeighborhood}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendProposal(req.id)}
                  className={`font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 ${
                    isSent
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                  }`}
                >
                  {isSent ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Orçamento Enviado!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
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
