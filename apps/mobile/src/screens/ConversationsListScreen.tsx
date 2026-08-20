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
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Mensagens In-App
          </h2>
          <p className="text-xs text-slate-500">
            Converse e receba propostas sem expor seu telefone
          </p>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Chat Protegido</span>
        </div>
      </div>

      {/* Lista de Conversas */}
      <div className="space-y-2.5">
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
            className="w-full text-left bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3 active:scale-[0.99]"
          >
            <div className="relative shrink-0">
              <img
                src={conv.avatarUrl}
                alt={conv.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-100"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {conv.name}
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  {conv.time}
                </span>
              </div>

              <span className="text-[10px] text-slate-500 block mb-1">
                {conv.subtitle}
              </span>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 truncate">
                  {conv.lastMessage}
                </p>

                {conv.hasPendingProposal && (
                  <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full shrink-0 border border-amber-200">
                    Orçamento
                  </span>
                )}

                {conv.unreadCount > 0 && (
                  <span className="w-4 h-4 bg-brand-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
