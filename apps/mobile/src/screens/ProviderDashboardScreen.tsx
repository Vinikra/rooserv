import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wallet, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock, 
  Send, 
  CheckCircle, 
  MapPin,
  Inbox,
  X,
  AlertCircle,
  LoaderCircle
} from 'lucide-react';
import { formatCurrencyBRL } from '@servicos/shared';

interface ProviderDashboardScreenProps {
  onOpenOnboarding?: () => void;
}

export const ProviderDashboardScreen: React.FC<ProviderDashboardScreenProps> = ({
  onOpenOnboarding,
}) => {
  const {
    requests,
    providers,
    proposals,
    currentUser,
    providerWallet,
    payoutRequests,
    providerOnboardingStatus,
    sendServiceProposal,
    requestProviderPayout,
  } = useApp();

  const currentProvider = providers.find((p) => p.profileId === currentUser?.id);
  const verificationStatus = providerOnboardingStatus?.verificationStatus
    || currentProvider?.verificationStatus
    || 'pending';

  // Cálculos da Carteira
  const availableBalance = providerWallet?.balanceAvailable || 0;
  const escrowBalance = providerWallet?.balanceInEscrow || 0;
  const hasOpenPayout = payoutRequests.some((payout) => (
    payout.status === 'pending' || payout.status === 'processing' || payout.requiresManualReview
  ));

  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [proposalSentId, setProposalSentId] = useState<string | null>(null);
  const [proposalRequestId, setProposalRequestId] = useState<string | null>(null);
  const [laborAmount, setLaborAmount] = useState('');
  const [materialsAmount, setMaterialsAmount] = useState('0');
  const [estimatedDays, setEstimatedDays] = useState('1');
  const [warrantyDays, setWarrantyDays] = useState('30');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [isSendingProposal, setIsSendingProposal] = useState(false);

  const handleRequestPayout = async () => {
    if (availableBalance <= 0 || hasOpenPayout) return;
    setIsRequestingPayout(true);
    setPayoutError(null);
    try {
      await requestProviderPayout(availableBalance);
      setPayoutSuccess(true);
      setTimeout(() => setPayoutSuccess(false), 4000);
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : 'Não foi possível solicitar o saque.');
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const openProposalModal = (reqId: string, budget?: number) => {
    setProposalRequestId(reqId);
    setLaborAmount(budget ? String(budget) : '');
    setMaterialsAmount('0');
    setEstimatedDays('1');
    setWarrantyDays('30');
    setProposalDescription('');
    setProposalError(null);
  };

  const handleSendProposal = async () => {
    if (!proposalRequestId) return;
    setIsSendingProposal(true);
    setProposalError(null);
    try {
      const labor = Number(laborAmount);
      const materials = Number(materialsAmount);
      if (!Number.isFinite(labor) || labor < 1 || !Number.isFinite(materials) || materials < 0
          || labor + materials < 30 || labor + materials > 100000) {
        throw new Error('O total do orçamento deve ficar entre R$ 30 e R$ 100.000.');
      }
      await sendServiceProposal({
        requestId: proposalRequestId,
        laborAmount: labor,
        materialsAmount: materials,
        estimatedDays: Number(estimatedDays),
        warrantyDays: Number(warrantyDays),
        description: proposalDescription.trim(),
      });
      setProposalSentId(proposalRequestId);
      setProposalRequestId(null);
      setTimeout(() => setProposalSentId(null), 2500);
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : 'Não foi possível enviar o orçamento.');
    } finally {
      setIsSendingProposal(false);
    }
  };

  if (!currentProvider || verificationStatus !== 'verified') {
    const isUnderReview = verificationStatus === 'under_review';
    const isRejected = verificationStatus === 'rejected';
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-12">
        <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-xl font-black text-slate-900">
            {isUnderReview ? 'Documentos em análise' : isRejected ? 'Cadastro precisa de ajustes' : 'Complete seu cadastro profissional'}
          </h2>
          <p className="text-sm text-slate-600">
            {isUnderReview
              ? 'Seu cadastro foi enviado e está aguardando a validação da gestão RooServ.'
              : isRejected
              ? 'Revise os dados ou documentos indicados e envie novamente para análise.'
              : 'Envie seus dados e documentos para solicitar a verificação RooServ.'}
          </p>
          {isRejected && providerOnboardingStatus?.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800 text-left">
              <strong className="block text-xs uppercase tracking-wide mb-1">Motivo informado pela gestão</strong>
              {providerOnboardingStatus.rejectionReason}
            </div>
          )}
          {onOpenOnboarding && !isUnderReview && (
            <button type="button" onClick={onOpenOnboarding} className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-3 rounded-2xl">
              {isRejected ? 'Corrigir e reenviar cadastro' : 'Completar cadastro profissional'}
            </button>
          )}
        </div>
      </div>
    );
  }

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

            {/* Valores aguardando liberação */}
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-extrabold">Aguardando repasse</span>
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
              disabled={availableBalance <= 0 || hasOpenPayout || isRequestingPayout}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm sm:text-base py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isRequestingPayout ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
              <span>{isRequestingPayout
                ? 'Registrando saque...'
                : hasOpenPayout
                ? 'Saque em andamento'
                : `Solicitar Saque Pix (${formatCurrencyBRL(availableBalance)})`}</span>
            </button>

            {payoutSuccess && (
              <div className="bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-xs sm:text-sm p-3.5 rounded-2xl text-center font-bold animate-in fade-in">
                ✓ Solicitação registrada. O valor foi reservado e aguarda processamento para sua chave Pix.
              </div>
            )}

            {payoutError && (
              <div role="alert" className="bg-red-500/20 border border-red-400/40 text-red-200 text-xs sm:text-sm p-3.5 rounded-2xl font-bold">
                {payoutError}
              </div>
            )}

            {payoutRequests.length > 0 && (
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold">Últimos saques</span>
                {payoutRequests.slice(0, 3).map((payout) => (
                  <div key={payout.id} className="text-xs bg-slate-800/80 rounded-xl px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{formatCurrencyBRL(payout.amount)}</strong>
                      <span className={`font-bold ${payout.status === 'completed' ? 'text-emerald-400' : payout.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                        {payout.requiresManualReview
                          ? 'Em análise'
                          : payout.status === 'completed'
                          ? 'Concluído'
                          : payout.status === 'failed'
                          ? 'Falhou'
                          : payout.status === 'processing'
                          ? 'Processando'
                          : 'Pendente'}
                      </span>
                    </div>
                    {payout.requiresManualReview && (
                      <p className="text-[11px] leading-snug text-amber-200">
                        A confirmação do gateway está em revisão. O valor continua reservado.
                      </p>
                    )}
                  </div>
                ))}
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
            {requests.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-3">
                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Inbox className="w-7 h-7" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Nenhuma oportunidade aberta no momento
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Assim que um morador de Rondonópolis publicar um pedido de orçamento, ele aparecerá aqui instantaneamente com notificação sonora e no app.
                </p>
              </div>
            ) : (
              requests.map((req) => {
              const existingProposal = proposals.find((proposal) => proposal.requestId === req.id);
              const isSent = proposalSentId === req.id || Boolean(existingProposal);
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
                      onClick={() => openProposalModal(req.id, existingProposal?.totalAmount || req.budgetEstimate)}
                      className={`font-black text-xs sm:text-sm px-5 py-3 rounded-xl transition-all flex items-center gap-2 active:scale-95 cursor-pointer ${
                        isSent
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-950 hover:bg-slate-900 text-white shadow-sm'
                      }`}
                    >
                      {isSent ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>{proposalSentId === req.id ? 'Orçamento Enviado!' : 'Editar Orçamento'}</span>
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
            }))}
          </div>
        </div>
      </div>

      {proposalRequestId && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="proposal-modal-title" className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="proposal-modal-title" className="text-lg font-black text-slate-900">Orçamento oficial</h3>
                <p className="text-xs text-slate-500">O cliente receberá a proposta no chat seguro.</p>
              </div>
              <button type="button" onClick={() => setProposalRequestId(null)} disabled={isSendingProposal} aria-label="Fechar orçamento" className="p-2 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-extrabold text-slate-700">
                Mão de obra (R$)
                <input type="number" min="1" step="0.01" value={laborAmount} onChange={(event) => setLaborAmount(event.target.value)} className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-3 text-sm" />
              </label>
              <label className="text-xs font-extrabold text-slate-700">
                Materiais (R$)
                <input type="number" min="0" step="0.01" value={materialsAmount} onChange={(event) => setMaterialsAmount(event.target.value)} className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-3 text-sm" />
              </label>
              <label className="text-xs font-extrabold text-slate-700">
                Prazo (dias)
                <input type="number" min="1" max="365" value={estimatedDays} onChange={(event) => setEstimatedDays(event.target.value)} className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-3 text-sm" />
              </label>
              <label className="text-xs font-extrabold text-slate-700">
                Garantia (dias)
                <input type="number" min="0" max="3650" value={warrantyDays} onChange={(event) => setWarrantyDays(event.target.value)} className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-3 text-sm" />
              </label>
            </div>

            <label className="block text-xs font-extrabold text-slate-700">
              Descrição do serviço
              <textarea rows={4} maxLength={2000} value={proposalDescription} onChange={(event) => setProposalDescription(event.target.value)} placeholder="Detalhe o que está incluso, materiais e condições." className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-3 text-sm resize-none" />
            </label>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex justify-between text-sm">
              <span className="font-bold text-slate-600">Valor total</span>
              <strong className="font-black text-slate-950">{formatCurrencyBRL((Number(laborAmount) || 0) + (Number(materialsAmount) || 0))}</strong>
            </div>

            {proposalError && <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs font-bold">{proposalError}</div>}

            <button type="button" onClick={handleSendProposal} disabled={isSendingProposal} className="w-full bg-slate-950 hover:bg-slate-900 disabled:opacity-60 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
              {isSendingProposal ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>{isSendingProposal ? 'Enviando...' : 'Registrar e enviar orçamento'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
