import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  MessageSquare, 
  ShieldCheck, 
  CheckCheck, 
  ChevronRight, 
  Sparkles, 
  Clock 
} from 'lucide-react';

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
  hasPendingProposal?: boolean;
}

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
  const { currentRole, providers } = useApp();

  const mockConversations: ConversationItem[] = [
    {
      id: 'conv-1',
      partnerId: providers[0]?.id || 'p1',
      name: currentRole === 'provider' ? 'Mariana Alcantara' : 'Carlos Eduardo (Eletricista)',
      avatarUrl: currentRole === 'provider' 
        ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
        : 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150',
      role: currentRole === 'provider' ? 'client' : 'provider',
      subtitle: currentRole === 'provider' ? 'Bairro Vila Aurora' : 'Eletricista SENAI • Centro',
      lastMessage: 'Acabei de gerar a proposta oficial do serviço para você aprovar: R$ 220,00',
      time: '14:25',
      unreadCount: 1,
      hasPendingProposal: true,
    },
    {
      id: 'conv-2',
      partnerId: providers[1]?.id || 'p2',
      name: currentRole === 'provider' ? 'Roberto Silva' : 'Ana Paula Santos (Faxinas)',
      avatarUrl: currentRole === 'provider'
        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
        : 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      role: currentRole === 'provider' ? 'client' : 'provider',
      subtitle: currentRole === 'provider' ? 'Bairro Vila Operária' : 'Limpeza Detalhada • Sagrada Família',
      lastMessage: 'Perfeito! Quinta-feira às 08:30 estarei aí.',
      time: 'Ontem',
      unreadCount: 0,
      hasPendingProposal: false,
    },
  ];

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-md mx-auto">
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
          <div
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
            className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3 active:scale-[0.99]"
          >
            <div className="relative">
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
          </div>
        ))}
      </div>
    </div>
  );
};
