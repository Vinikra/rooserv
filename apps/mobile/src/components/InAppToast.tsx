import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  MessageSquare, 
  DollarSign, 
  ShieldCheck, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { InAppNotification } from '@servicos/shared';

interface InAppToastProps {
  notification: InAppNotification | null;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export const InAppToast: React.FC<InAppToastProps> = ({
  notification,
  onClose,
  onNavigate,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 5500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const handleClick = () => {
    if (notification.actionTab && onNavigate) {
      onNavigate(notification.actionTab);
    }
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const getIcon = () => {
    switch (notification.type) {
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

  return (
    <div
      className={`fixed top-3 left-0 right-0 max-w-md mx-auto px-4 z-50 transition-all duration-300 transform pointer-events-auto ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-2xl border border-slate-700/80 flex items-start gap-3.5 backdrop-blur-md">
        <div className="p-2.5 bg-white rounded-2xl shrink-0 shadow-md">
          {getIcon()}
        </div>

        <button
          type="button"
          onClick={handleClick}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-brand-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              <span>Aviso no App</span>
            </span>
          </div>

          <h4 className="text-sm font-black text-white leading-tight truncate">
            {notification.title}
          </h4>

          <p className="text-xs text-slate-300 leading-snug line-clamp-2 mt-0.5 font-medium">
            {notification.message}
          </p>

          {notification.actionTab && (
            <span className="text-xs text-brand-400 font-extrabold flex items-center gap-1 mt-1.5">
              <span>Toque para ver</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 200);
          }}
          className="text-slate-400 hover:text-white p-1 rounded-full shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
