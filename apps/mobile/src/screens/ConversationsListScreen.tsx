import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ChevronRight } from 'lucide-react';

interface ConversationsListScreenProps {
  onSelectConversation: (user: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  }) => void;
}

export const ConversationsListScreen: React.FC<ConversationsListScreenProps> = ({
  onSelectConversation,
}) => {
  const { currentRole } = useApp();

  const mockConversations = currentRole === 'provider' ? [
    {
      id: 'c1',
      partnerId: 'user-client-1',
      name: 'Mariana Souza (Jardim Atlântico)',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      role: 'client' as const,
      subtitle: 'Troca de Chuveiro e Disjuntor',
      lastMessage: 'Perfeito! Qual horário você consegue vir hoje?',
      time: '14:35',
      unreadCount: 1,
      hasPendingProposal: true,
    },
    {
      id: 'c2',
      partnerId: 'user-client-2',
      name: 'Carlos Mendes (Vila Aurora)',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      role: 'client' as const,
      subtitle: 'Instalação de Tomada 220v Ar',
      lastMessage: 'Obrigado pelo serviço, já liberei o pagamento!',
      time: 'Ontem',
      unreadCount: 0,
      hasPendingProposal: false,
    }
  ] : [
    {
      id: 'c1',
      partnerId: 'prov-1',
      name: 'Marcos Silva • Eletricista',
      avatarUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150',
      role: 'provider' as const,
      subtitle: 'Jardim Atlântico • Selo Verificado',
      lastMessage: 'Acabei de gerar o orçamento formal com o seguro de 60 dias:',
      time: '14:36',
      unreadCount: 1,
      hasPendingProposal: true,
    },
    {
      id: 'c3',
      partnerId: 'prov-3',
      name: 'Roberto Climatização',
      avatarUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150',
      role: 'provider' as const,
      subtitle: 'Vila Aurora • 4.8 Estrelas',
      lastMessage: 'Combinado! Sexta-feira às 09h estou no local.',
      time: '11:20',
      unreadCount: 0,
      hasPendingProposal: false,
    }
  ];

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
      <div className="space-y-3">
        {mockConversations.map((conv) => (
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
    </div>
  );
};
