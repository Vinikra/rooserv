import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Order, 
  ORDER_STATUS_LABELS, 
  SUGGESTED_REVIEW_TAGS,
  formatCurrencyBRL 
} from '@servicos/shared';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle, 
  Star, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  RotateCcw 
} from 'lucide-react';

export const OrdersScreen: React.FC = () => {
  const { 
    orders, 
    currentRole, 
    markOrderAsCompletedByProvider, 
    confirmAndReleaseEscrow, 
    openDispute 
  } = useApp();

  // Modal de Avaliação & Liberação de Pagamento
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Pontual', 'Caprichoso', 'Preço Justo']);

  // Modal de Abertura de Disputa / Reportar Problema
  const [selectedOrderForDispute, setSelectedOrderForDispute] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState<string>('Prestador não compareceu no endereço');
  const [disputeDetails, setDisputeDetails] = useState<string>('');

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleFinalizeAndRelease = () => {
    if (!selectedOrderForReview) return;
    confirmAndReleaseEscrow({
      orderId: selectedOrderForReview.id,
      rating,
      comment,
      tags: selectedTags,
    });
    setSelectedOrderForReview(null);
  };

  const handleConfirmDispute = () => {
    if (!selectedOrderForDispute) return;
    openDispute(selectedOrderForDispute.id, disputeReason, disputeDetails);
    setSelectedOrderForDispute(null);
    setDisputeDetails('');
  };

  return (
    <div className="pb-28 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
          {currentRole === 'provider' ? 'Serviços em Andamento' : 'Meus Pedidos & Contratos'}
        </h2>
        <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-xl">
          {`${orders.length} pedidos`}
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <p className="text-base font-extrabold text-slate-800">Nenhum serviço em andamento</p>
          <p className="text-xs text-slate-500">
            Contrate um profissional ou faça um pedido de orçamento para acompanhar por aqui.
          </p>
        </div>
      ) : (
        orders.map((order) => {
          const statusInfo = ORDER_STATUS_LABELS[order.status];
          const isEscrowLocked = order.status === 'payment_in_escrow';
          const isReadyForApproval = order.status === 'completed_by_provider';
          const isFinished = order.status === 'approved_by_client';

          return (
            <div
              key={order.id}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5"
            >
              {/* Header do Pedido */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                    {order.orderNumber}
                  </span>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {currentRole === 'provider' 
                      ? `Cliente: ${order.client?.fullName}` 
                      : `Profissional: ${order.provider?.profile?.fullName}`}
                  </h4>
                </div>

                <div 
                  className="px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-2 shrink-0"
                  style={{
                    backgroundColor: `${statusInfo.color}15`,
                    color: statusInfo.color,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                  <span>{statusInfo.label}</span>
                </div>
              </div>

              {/* Detalhes Financeiros e Custódia */}
              <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Valor do Contrato:</span>
                  <strong className="text-base sm:text-lg font-black text-slate-900">{formatCurrencyBRL(order.totalAmount)}</strong>
                </div>

                {isEscrowLocked && (
                  <div className="flex items-center gap-2.5 bg-blue-50 text-blue-950 p-3 rounded-xl border border-blue-200/80 text-xs font-medium">
                    <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                    <span>
                      <strong>Custódia Segura RooServ:</strong> O dinheiro está protegido pela plataforma. O profissional trabalha com a certeza de pagamento garantido.
                    </span>
                  </div>
                )}

                {order.status === 'disputed' && (
                  <div className="flex items-center gap-2.5 bg-red-50 text-red-950 p-3 rounded-xl border border-red-200/80 text-xs font-medium">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                    <span>
                      {`Disputa em Mediação: Motivo "${order.disputeReason}". A gestão RooServ está intermediando o caso.`}
                    </span>
                  </div>
                )}

                {order.status === 'refunded' && (
                  <div className="flex items-center gap-2.5 bg-slate-100 text-slate-900 p-3 rounded-xl border border-slate-200 text-xs font-medium">
                    <RotateCcw className="w-5 h-5 text-slate-600 shrink-0" />
                    <span>
                      {`Valor Reembolsado: ${formatCurrencyBRL(order.totalAmount)} devolvidos ao morador.`}
                    </span>
                  </div>
                )}

                {isReadyForApproval && order.status !== 'disputed' && (
                  <div className="flex items-center gap-2.5 bg-purple-50 text-purple-950 p-3 rounded-xl border border-purple-200 text-xs font-medium">
                    <Clock className="w-5 h-5 text-purple-600 shrink-0" />
                    <span>
                      O prestador concluiu o trabalho! Revise a execução e clique em <strong>Aprovar e Liberar</strong> para transferir o valor.
                    </span>
                  </div>
                )}

                {isFinished && (
                  <div className="flex items-center gap-2.5 bg-emerald-50 text-emerald-950 p-3 rounded-xl border border-emerald-200 text-xs font-medium">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>
                      {`Serviço finalizado com sucesso e repasse de ${formatCurrencyBRL(order.providerPayoutAmount)} liberado ao profissional.`}
                    </span>
                  </div>
                )}
              </div>

              {/* Botões de Ação com Altura de Toque Ampla */}
              <div className="flex items-center justify-between pt-1">
                {/* Botão Reportar Problema / Disputa (Cliente) */}
                {currentRole === 'client' && (order.status === 'payment_in_escrow' || order.status === 'completed_by_provider') && (
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForDispute(order)}
                    className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 p-2 rounded-lg"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Reportar Problema</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {/* Ação do Prestador: Concluir serviço */}
                  {currentRole === 'provider' && order.status === 'payment_in_escrow' && (
                    <button
                      type="button"
                      onClick={() => markOrderAsCompletedByProvider(order.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs sm:text-sm px-4 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Marcar como Concluído</span>
                    </button>
                  )}

                  {/* Ação do Cliente: Aprovar serviço e Liberar Pagamento */}
                  {currentRole === 'client' && (order.status === 'payment_in_escrow' || order.status === 'completed_by_provider') && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForReview(order)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95 flex items-center gap-2"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      <span>Aprovar e Liberar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Modal de Avaliação e Liberação de Custódia */}
      {selectedOrderForReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Avaliar e Liberar Pagamento
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {`Profissional: ${selectedOrderForReview.provider?.profile?.fullName}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForReview(null)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Estrelas */}
            <div className="text-center py-3 space-y-2 bg-amber-50/50 rounded-2xl border border-amber-200/60 p-4">
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 block">
                Que nota você dá para o serviço executado?
              </span>
              <div className="flex items-center justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1.5 text-amber-400 hover:scale-125 transition-transform active:scale-95"
                  >
                    <Star
                      className={`w-9 h-9 ${
                        star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Tags de Elogio / Qualidade */}
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 block mb-2">
                Destaques do profissional:
              </span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_REVIEW_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl border font-bold transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-sm ring-1 ring-brand-500'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comentário */}
            <div>
              <label htmlFor="review-comment" className="text-xs sm:text-sm font-extrabold text-slate-800 block mb-1.5">
                Deixe um comentário para os outros moradores de Rondonópolis:
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: O profissional chegou pontualmente, fez o serviço com muito capricho e limpou tudo ao final..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Confirmação e Liberação */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleFinalizeAndRelease}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{`Confirmar e Liberar ${formatCurrencyBRL(selectedOrderForReview.providerPayoutAmount)}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abertura de Disputa / Problema */}
      {selectedOrderForDispute && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Reportar Problema no Serviço
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {`Pedido: ${selectedOrderForDispute.orderNumber}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForDispute(null)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
              <span>O pagamento de </span>
              <strong>{formatCurrencyBRL(selectedOrderForDispute.totalAmount)}</strong>
              <span> continuará </span>
              <strong>bloqueado sob custódia segura</strong>
              <span> enquanto a moderação analisa o caso.</span>
            </div>

            <div>
              <label htmlFor="dispute-reason" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                Qual o motivo principal?
              </label>
              <select
                id="dispute-reason"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 font-bold focus:outline-none focus:border-red-500"
              >
                <option value="Prestador não compareceu no endereço">Prestador não compareceu no endereço</option>
                <option value="Serviço incompleto ou com defeito">Serviço incompleto ou com defeito</option>
                <option value="Danos materiais no local da obra">Danos materiais no local da obra</option>
                <option value="Desistência de comum acordo">Desistência de comum acordo</option>
              </select>
            </div>

            <div>
              <label htmlFor="dispute-details" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                Descreva detalhadamente o ocorrido:
              </label>
              <textarea
                id="dispute-details"
                value={disputeDetails}
                onChange={(e) => setDisputeDetails(e.target.value)}
                placeholder="Ex: O profissional agendou para as 14h mas não veio e não respondeu as mensagens..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmDispute}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 mt-2"
            >
              <ShieldAlert className="w-5 h-5" />
              <span>Abrir Disputa com a Moderação RooServ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
