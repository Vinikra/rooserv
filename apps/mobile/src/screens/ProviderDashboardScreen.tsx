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
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header do Prestador */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <span className="text-xs font-black text-amber-600 uppercase tracking-wider block">
            Painel do Profissional
          </span>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
            {currentProvider.profile?.fullName}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs sm:text-sm font-extrabold px-4 py-2 rounded-xl border border-amber-300 transition-colors cursor-pointer"
            >
              + Novo Cadastro
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verificado RooServ</span>
          </div>
        </div>
      </div>

      {/* Layout Responsivo em 2 Colunas no Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Cartão da Carteira Digital */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-5 sticky top-24">
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
              <p className="text-xs text-slate-300 mt-1.5 font-medium">
                Chave Pix cadastrada: <strong className="text-amber-400 font-bold">{currentProvider.pixKey}</strong>
              </p>
            </div>

            {/* Dinheiro Retido em Custódia */}
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-extrabold">Retido em Custódia</span>
                  <strong className="text-white text-sm sm:text-base font-extrabold">{formatCurrencyBRL(escrowBalance)}</strong>
                </div>
              </div>
              <span className="text-xs text-blue-300 font-bold bg-blue-500/20 px-2.5 py-1 rounded-lg">
                Liberado pós-serviço
              </span>
            </div>

            {/* Botão de Saque Instantâneo via Pix */}
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={availableBalance <= 0}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm sm:text-base py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
        </div>

        {/* Coluna 2: Oportunidades e Chamados na Cidade */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-wider">
              Pedidos Recentes na Cidade ({requests.length})
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Moradores aguardando orçamento em Rondonópolis
            </span>
          </div>

          <div className="space-y-4">
            {requests.map((req) => {
              const isSent = proposalSentId === req.id;
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs bg-brand-50 text-brand-700 font-extrabold px-3 py-0.5 rounded-full border border-brand-200">
                          {req.category?.name}
                        </span>
                        {req.urgency === 'urgent_today' && (
                          <span className="text-xs bg-red-50 text-red-700 font-extrabold px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Urgente Hoje</span>
                          </span>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                        {req.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-500 block font-medium">Orçamento Previsto</span>
                      <strong className="text-base sm:text-lg font-black text-slate-900">
                        {req.budgetEstimate ? formatCurrencyBRL(req.budgetEstimate) : 'A combinar'}
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                    {`"${req.description}"`}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-slate-600 text-xs sm:text-sm">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>Bairro: <strong className="text-slate-900">{req.addressNeighborhood}</strong></span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendProposal(req.id)}
                      className={`font-black text-xs sm:text-sm px-5 py-3 rounded-xl transition-all flex items-center gap-2 active:scale-95 cursor-pointer ${
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
      </div>
    </div>
  );
};
