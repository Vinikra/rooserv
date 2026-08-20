import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ChevronRight, MessageSquare, Compass, Send } from 'lucide-react';
import { Order, ProviderProfile, UserRole } from '@servicos/shared';

interface ConversationItem {
  id: string;
  partnerId: string;
  name: string;
  avatarUrl: string;
  role: 'client' | 'provider';
  subtitle: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  hasPendingProposal: boolean;
}

interface ConversationsListScreenProps {
  onSelectConversation: (user: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  }) => void;
  onExplore?: () => void;
  onRequestQuote?: () => void;
}

function buildOrderConversation(order: Order, role: UserRole): ConversationItem {
  const isProvider = role === 'provider';
  const partnerName = isProvider
    ? order.client?.fullName || 'Cliente de Rondonópolis'
    : order.provider?.profile?.fullName || 'Profissional Parceiro';

  const partnerAvatar = isProvider
    ? order.client?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    : order.provider?.profile?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150';

  const lastMessage = order.status === 'payment_in_escrow'
    ? 'Valor retido sob custódia. Pronto para execução.'
    : 'Conversa segura vinculada ao pedido.';

  return {
    id: `conv-order-${order.id}`,
    partnerId: isProvider ? order.clientId : order.providerId,
    name: partnerName,
    avatarUrl: partnerAvatar,
    role: isProvider ? 'client' : 'provider',
    subtitle: `Pedido #${order.orderNumber} • ${order.serviceTitle || 'Serviço'}`,
    lastMessage,
    time: 'Hoje',
    unreadCount: 0,
    hasPendingProposal: order.status === 'draft',
  };
}

function buildProviderConversation(prov: ProviderProfile): ConversationItem | null {
  if (!prov.profile) return null;
  return {
    id: `conv-prov-${prov.id}`,
    partnerId: prov.id,
    name: prov.profile.fullName,
    avatarUrl: prov.profile.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    role: 'provider',
    subtitle: `${prov.profile.neighborhood} • ${prov.categories?.[0]?.name || 'Prestador de Serviços'}`,
    lastMessage: 'Clique para iniciar uma conversa e pedir um orçamento formal.',
    time: 'Disponível',
    unreadCount: 0,
    hasPendingProposal: false,
  };
}

export const ConversationsListScreen: React.FC<ConversationsListScreenProps> = ({
  onSelectConversation,
  onExplore,
  onRequestQuote,
}) => {
  const { currentRole, orders, providers } = useApp();

  const conversations = React.useMemo(() => {
    const list = orders.map((o) => buildOrderConversation(o, currentRole));

    if (currentRole === 'client' && list.length === 0) {
      for (const prov of providers) {
        const item = buildProviderConversation(prov);
        if (item) list.push(item);
      }
    }

    return list;
  }, [orders, providers, currentRole]);

  return (
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
            Mensagens & Chat em Tempo Real
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Converse com segurança, envie propostas e tire dúvidas sem expor seu telefone
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Chat Protegido</span>
        </div>
      </div>

      {/* Lista de Conversas */}
      {conversations.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200 shadow-sm space-y-4 max-w-md mx-auto my-6">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-brand-100">
            <MessageSquare className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Nenhuma conversa iniciada
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {currentRole === 'provider'
                ? 'Suas conversas com clientes em Rondonópolis aparecerão aqui assim que você responder a uma oportunidade ou receber uma solicitação.'
                : 'Suas conversas com profissionais da cidade aparecerão aqui assim que você pedir um orçamento ou contratar um serviço.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            {onRequestQuote && (
              <button
                type="button"
                onClick={onRequestQuote}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Pedir Orçamento Grátis</span>
              </button>
            )}

            {onExplore && (
              <button
                type="button"
                onClick={onExplore}
                className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-brand-600" />
                <span>Explorar Profissionais</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <button
              type="button"
              key={conv.id}
              onClick={() =>
                onSelectConversation({
                  id: conv.partnerId,
                  name: conv.name,
                  avatarUrl: conv.avatarUrl,
                  role: conv.role,
                  subtitle: conv.subtitle,
                })
              }
              className="w-full text-left bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 active:scale-[0.99]"
            >
              <div className="relative shrink-0">
                <img
                  src={conv.avatarUrl}
                  alt={conv.name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-xs"
                />
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand-600 rounded-full border-2 border-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                    {conv.name}
                  </h4>
                  <span className="text-xs text-slate-400 font-medium shrink-0">
                    {conv.time}
                  </span>
                </div>

                <span className="text-xs text-brand-600 font-bold block mb-1">
                  {conv.subtitle}
                </span>

                <p className="text-xs sm:text-sm text-slate-600 truncate font-medium">
                  {conv.lastMessage}
                </p>

                {conv.hasPendingProposal && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                    <span>★ Orçamento Formal Aguardando Aprovação</span>
                  </div>
                )}
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
