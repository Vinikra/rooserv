import React from 'react';
import { 
  Compass, 
  FileText, 
  PlusCircle, 
  Wallet, 
  Inbox, 
  MessageSquare 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BottomTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ activeTab, setActiveTab }) => {
  const { currentRole, orders, requests } = useApp();

  const activeOrdersCount = orders.filter(
    (o) => o.status === 'payment_in_escrow' || o.status === 'completed_by_provider'
  ).length;

  if (currentRole === 'admin') {
    return null;
  }

  if (currentRole === 'provider') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200/90 pt-2 pb-safe px-3 flex items-center justify-around z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          type="button"
          onClick={() => setActiveTab('provider_dashboard')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold transition-all active:scale-95 ${
            activeTab === 'provider_dashboard' ? 'text-amber-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className="w-6 h-6" />
          <span>Carteira</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('provider_leads')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold relative transition-all active:scale-95 ${
            activeTab === 'provider_leads' ? 'text-amber-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Inbox className="w-6 h-6" />
          <span>Oportunidades</span>
          {requests.length > 0 && (
            <span className="absolute top-0 right-4 bg-amber-500 text-slate-950 text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black shadow-xs">
              {requests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold relative transition-all active:scale-95 ${
            activeTab === 'messages' ? 'text-amber-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-6 h-6" />
          <span>Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold relative transition-all active:scale-95 ${
            activeTab === 'orders' ? 'text-amber-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-6 h-6" />
          <span>Serviços</span>
          {activeOrdersCount > 0 && (
            <span className="absolute top-0 right-4 bg-brand-600 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black">
              {activeOrdersCount}
            </span>
          )}
        </button>
      </nav>
    );
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200/90 pt-2 pb-safe px-3 flex items-center justify-around z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <button
        type="button"
        onClick={() => setActiveTab('explore')}
        className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold transition-all active:scale-95 ${
          activeTab === 'explore' ? 'text-brand-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Compass className="w-6 h-6" />
        <span>Início</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('messages')}
        className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold relative transition-all active:scale-95 ${
          activeTab === 'messages' ? 'text-brand-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <MessageSquare className="w-6 h-6" />
        <span>Mensagens</span>
      </button>

      {/* Botão Central de Destaque para Pedir Orçamento */}
      <button
        type="button"
        onClick={() => setActiveTab('new_request')}
        className="flex-1 flex flex-col items-center gap-0.5 -mt-6 active:scale-90 transition-transform"
      >
        <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/40 border-2 border-white">
          <PlusCircle className="w-7 h-7" />
        </div>
        <span className="text-xs font-black text-brand-600">Pedir</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('orders')}
        className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-xs font-bold relative transition-all active:scale-95 ${
          activeTab === 'orders' ? 'text-brand-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <FileText className="w-6 h-6" />
        <span>Meus Pedidos</span>
        {activeOrdersCount > 0 && (
          <span className="absolute top-0 right-4 bg-brand-600 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black">
            {activeOrdersCount}
          </span>
        )}
      </button>
    </nav>
  );
};
