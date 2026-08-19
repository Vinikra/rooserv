import React from 'react';
import { 
  X, 
  Bell, 
  Sparkles, 
  MessageSquare, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  ChevronRight, 
  ShieldCheck 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface NotificationItem {
  id: string;
  type: 'order' | 'chat' | 'proposal' | 'payout' | 'verification';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  actionTab?: string;
}

interface NotificationModalProps {
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  onClose,
  onNavigateTab,
}) => {
  const { currentRole } = useApp();

  const notifications: NotificationItem[] = currentRole === 'provider' ? [
    {
      id: 'n1',
      type: 'order',
      title: 'Novo Pedido na Vila Aurora! ⚡',
      message: 'Mariana Alcantara precisa de troca de fiação de chuveiro urgente.',
      time: 'Há 5 min',
      isRead: false,
      actionTab: 'provider_leads',
    },
    {
      id: 'n2',
      type: 'chat',
      title: 'Nova Mensagem no Chat',
      message: 'Mariana: "O disjuntor de 20A está desarmando após o banho..."',
      time: 'Há 12 min',
      isRead: false,
      actionTab: 'messages',
    },
    {
      id: 'n3',
      type: 'payout',
      title: 'Pagamento em Custódia Garantido! 💰',
      message: 'O cliente confirmou R$ 250,00. O valor já está garantido para você.',
      time: 'Há 2 horas',
      isRead: true,
      actionTab: 'orders',
    },
  ] : [
    {
      id: 'n1',
      type: 'proposal',
      title: 'Orçamento Oficial Recebido! ✨',
      message: 'Carlos Eduardo enviou uma proposta de R$ 220,00 com 60 dias de garantia.',
      time: 'Há 3 min',
      isRead: false,
      actionTab: 'messages',
    },
    {
      id: 'n2',
      type: 'order',
      title: 'Custódia Ativa no RooServ',
      message: 'Seu pagamento está 100% protegido. O profissional iniciará o atendimento.',
      time: 'Há 1 hora',
      isRead: true,
      actionTab: 'orders',
    },
  ];

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'proposal':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-brand-500" />;
      case 'payout':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Notificações em Tempo Real
              </h3>
              <p className="text-[11px] text-slate-500">
                Avisos de orçamentos, mensagens e pagamentos em Roo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Notificações */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.actionTab) {
                  onNavigateTab(item.actionTab);
                }
                onClose();
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 active:scale-[0.99] ${
                item.isRead
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-indigo-50/40 border-indigo-200 shadow-sm'
              }`}
            >
              <div className="p-2 bg-white rounded-xl shadow-xs shrink-0 border border-slate-100">
                {getIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                    {item.time}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-normal mt-0.5">
                  {item.message}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
