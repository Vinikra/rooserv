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
  const [disputeReason, setDisputeReason] = useState<string>('Prestador não compareceu');
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
    <div className="pb-24 pt-2 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {currentRole === 'provider' ? 'Serviços em Andamento' : 'Meus Pedidos & Contratos'}
        </h2>
        <span className="text-xs text-slate-500 font-medium">
          {orders.length} pedidos
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-1">Nenhum serviço em andamento</p>
          <p className="text-xs text-slate-500">
            Contrate um profissional ou faça um pedido para acompanhar por aqui.
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
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3.5"
            >
              {/* Header do Pedido */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {order.orderNumber}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">
                    {currentRole === 'provider' 
                      ? `Cliente: ${order.client?.fullName}` 
                      : `Profissional: ${order.provider?.profile?.fullName}`}
                  </h4>
                </div>

                <div 
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5"
                  style={{
                    backgroundColor: `${statusInfo.color}15`,
                    color: statusInfo.color,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                  <span>{statusInfo.label}</span>
                </div>
              </div>

              {/* Detalhes Financeiros e Custódia */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Valor do Contrato:</span>
                  <strong className="text-sm text-slate-900">{formatCurrencyBRL(order.totalAmount)}</strong>
                </div>

                {isEscrowLocked && (
                  <div className="flex items-center gap-2 bg-blue-50 text-blue-900 p-2 rounded-lg border border-blue-200/60 text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Custódia Ativa:</strong> O valor está retido com segurança. O prestador executará o serviço sabendo que o dinheiro já está garantido.
                    </span>
                  </div>
                )}

                {order.status === 'disputed' && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-900 p-2 rounded-lg border border-red-200/80 text-[11px]">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      <strong>Disputa em Mediação:</strong> Motivo: "{order.disputeReason}". A equipe RooServ está analisando para liberação ou reembolso.
                    </span>
                  </div>
                )}

                {order.status === 'refunded' && (
                  <div className="flex items-center gap-2 bg-slate-100 text-slate-800 p-2 rounded-lg border border-slate-200 text-[11px]">
                    <RotateCcw className="w-4 h-4 text-slate-600 shrink-0" />
                    <span>
                      <strong>Valor Reembolsado:</strong> {formatCurrencyBRL(order.totalAmount)} devolvidos ao contratante.
                    </span>
                  </div>
                )}

                {isReadyForApproval && order.status !== 'disputed' && (
                  <div className="flex items-center gap-2 bg-purple-50 text-purple-900 p-2 rounded-lg border border-purple-200/60 text-[11px]">
                    <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      O prestador concluiu o trabalho! Revise e clique em <strong>Aprovar e Liberar</strong> para liberar o repasse.
                    </span>
                  </div>
                )}

                {isFinished && (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 p-2 rounded-lg border border-emerald-200/60 text-[11px]">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Serviço concluído e repasse de <strong>{formatCurrencyBRL(order.providerPayoutAmount)}</strong> creditado na carteira do profissional.
                    </span>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between pt-1">
                {/* Botão Reportar Problema / Disputa (Cliente) */}
                {currentRole === 'client' && (order.status === 'payment_in_escrow' || order.status === 'completed_by_provider') && (
                  <button
                    onClick={() => setSelectedOrderForDispute(order)}
                    className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1 hover:underline p-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Problema?</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {/* Ação do Prestador: Concluir serviço */}
                  {currentRole === 'provider' && order.status === 'payment_in_escrow' && (
                    <button
                      onClick={() => markOrderAsCompletedByProvider(order.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Marcar como Concluído</span>
                    </button>
                  )}

                  {/* Ação do Cliente: Aprovar serviço e Liberar Pagamento */}
                  {currentRole === 'client' && (order.status === 'payment_in_escrow' || order.status === 'completed_by_provider') && (
                    <button
                      onClick={() => setSelectedOrderForReview(order)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Avaliar e Liberar Pagamento
                </h3>
                <p className="text-xs text-slate-500">
                  Profissional: {selectedOrderForReview.provider?.profile?.fullName}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Estrelas */}
            <div className="text-center py-2 space-y-1">
              <span className="text-xs font-semibold text-slate-700 block">
                Que nota você dá para o serviço executado?
              </span>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Tags de Elogio / Qualidade */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                Destaques do profissional:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_REVIEW_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => handleToggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500 text-brand-700 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comentário */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Deixe um comentário para os outros moradores da cidade:
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: O profissional chegou na hora, fez o trabalho perfeito e deixou tudo limpo..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Confirmação e Liberação */}
            <div className="pt-2">
              <button
                onClick={handleFinalizeAndRelease}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirmar e Liberar {formatCurrencyBRL(selectedOrderForReview.providerPayoutAmount)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abertura de Disputa / Problema */}
      {selectedOrderForDispute && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reportar Problema no Serviço
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pedido: {selectedOrderForDispute.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForDispute(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              O pagamento de <strong>{formatCurrencyBRL(selectedOrderForDispute.totalAmount)}</strong> continuará <strong>bloqueado em custódia segura</strong> enquanto nossa moderação analisa a situação.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Qual o motivo principal?
              </label>
              <select
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-red-500"
              >
                <option value="Prestador não compareceu no endereço">Prestador não compareceu no endereço</option>
                <option value="Serviço incompleto ou com defeito">Serviço incompleto ou com defeito</option>
                <option value="Danos materiais no local da obra">Danos materiais no local da obra</option>
                <option value="Desistência de comum acordo">Desistência de comum acordo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descreva detalhadamente o ocorrido:
              </label>
              <textarea
                value={disputeDetails}
                onChange={(e) => setDisputeDetails(e.target.value)}
                placeholder="Ex: O profissional agendou para as 14h na Vila Aurora mas não veio e não atendeu as mensagens..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              onClick={handleConfirmDispute}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Abrir Disputa com a Moderação RooServ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
