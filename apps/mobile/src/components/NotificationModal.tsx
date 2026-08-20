import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  MessageSquare, 
  DollarSign, 
  ShieldCheck, 
  ChevronRight 
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'order' | 'message' | 'payment' | 'system';
  isRead: boolean;
  actionTab?: string;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNotification?: (tab: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onSelectNotification,
}) => {
  const [notifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Custódia Ativa no Serviço',
      message: 'Seu pagamento de R$ 150,00 foi retido com segurança. O prestador foi notificado para iniciar.',
      time: 'Há 5 min',
      type: 'payment',
      isRead: false,
      actionTab: 'orders',
    },
    {
      id: 'notif-2',
      title: 'Nova Mensagem do Prestador',
      message: 'Marcos Silva: "Chego por volta das 14h no Jardim Atlântico com o material."',
      time: 'Há 25 min',
      type: 'message',
      isRead: false,
      actionTab: 'messages',
    },
    {
      id: 'notif-3',
      title: 'Novo Orçamento Disponível',
      message: 'Um profissional enviou proposta para sua solicitação de "Troca de Chuveiro 220v".',
      time: 'Há 2 horas',
      type: 'order',
      isRead: true,
      actionTab: 'orders',
    },
    {
      id: 'notif-4',
      title: 'Garantia RooServ Ativa',
      message: 'Seu serviço possui cobertura de 60 dias pela Garantia de Conclusão da plataforma.',
      time: 'Ontem',
      type: 'system',
      isRead: true,
    },
  ]);

  if (!isOpen) return null;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'payment':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-brand-600" />;
      case 'order':
        return <CheckCircle className="w-4 h-4 text-indigo-600" />;
      case 'system':
      default:
        return <ShieldCheck className="w-4 h-4 text-amber-600" />;
    }
  };

  const handleNotificationClick = (actionTab?: string) => {
    if (actionTab && onSelectNotification) {
      onSelectNotification(actionTab);
    }
    onClose();
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
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Notificações */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {notifications.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => handleNotificationClick(item.actionTab)}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 active:scale-[0.99] ${
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
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
