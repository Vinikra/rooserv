import React from 'react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  MessageSquare, 
  DollarSign, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  CheckCheck,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InAppNotificationType } from '@servicos/shared';

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
  const { 
    notifications, 
    markAllNotificationsAsRead, 
    clearNotifications 
  } = useApp();

  if (!isOpen) return null;

  const getIcon = (type: InAppNotificationType) => {
    switch (type) {
      case 'payment':
        return <DollarSign className="w-5 h-5 text-emerald-600" />;
      case 'message':
        return <MessageSquare className="w-5 h-5 text-brand-600" />;
      case 'order':
        return <CheckCircle2 className="w-5 h-5 text-indigo-600" />;
      case 'proposal':
        return <Sparkles className="w-5 h-5 text-amber-600" />;
      case 'system':
      default:
        return <ShieldCheck className="w-5 h-5 text-brand-600" />;
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
      <div role="dialog" aria-modal="true" aria-labelledby="notifications-title" className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h3 id="notifications-title" className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Notificações no App
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Avisos em tempo real de chamados, propostas e pagamentos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Ações Rápidas: Marcar lidas & Limpar */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between text-xs font-bold pt-1 px-1">
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              className="text-brand-600 hover:text-brand-700 flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-brand-50 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Marcar todas como lidas</span>
            </button>

            <button
              type="button"
              onClick={clearNotifications}
              className="text-slate-400 hover:text-red-500 flex items-center gap-1 p-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          </div>
        )}

        {/* Lista de Notificações */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">Nenhuma notificação recente</p>
              <p className="text-xs text-slate-500">
                Você receberá alertas aqui quando houver novidades sobre seus serviços.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleNotificationClick(item.actionTab)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 active:scale-[0.99] cursor-pointer ${
                  item.isRead
                    ? 'bg-slate-50/70 border-slate-200'
                    : 'bg-indigo-50/50 border-indigo-200 shadow-sm ring-1 ring-indigo-200'
                }`}
              >
                <div className="p-2.5 bg-white rounded-2xl shadow-xs shrink-0 border border-slate-100 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">
                      {item.title}
                    </h4>
                    <span className="text-xs text-slate-400 shrink-0 font-medium">
                      {item.time}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1 font-medium">
                    {item.message}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-1.5" />
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-sm py-3.5 rounded-2xl transition-colors mt-2"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
