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
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 py-2 px-4 flex items-center justify-around z-30 shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('provider_dashboard')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'provider_dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span>Carteira</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('provider_leads')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium relative transition-colors ${
            activeTab === 'provider_leads' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Inbox className="w-5 h-5" />
          <span>Oportunidades</span>
          {requests.length > 0 && (
            <span className="absolute -top-1 right-2 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {requests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium relative transition-colors ${
            activeTab === 'messages' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Chat</span>
          <span className="absolute -top-1 right-1 bg-brand-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
            1
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium relative transition-colors ${
            activeTab === 'orders' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Serviços</span>
          {activeOrdersCount > 0 && (
            <span className="absolute -top-1 right-1 bg-brand-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
              {activeOrdersCount}
            </span>
          )}
        </button>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 py-2 px-4 flex items-center justify-between z-30 shadow-lg">
      <button
        type="button"
        onClick={() => setActiveTab('explore')}
        className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
          activeTab === 'explore' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span>Explorar</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('messages')}
        className={`flex flex-col items-center gap-1 text-[11px] font-medium relative transition-colors ${
          activeTab === 'messages' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span>Chat</span>
        <span className="absolute -top-1 right-1 bg-brand-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
          1
        </span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('new_request')}
        className="flex flex-col items-center gap-0.5 -mt-4"
      >
        <div className="w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-transform active:scale-95">
          <PlusCircle className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold text-brand-600">Pedir</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('orders')}
        className={`flex flex-col items-center gap-1 text-[11px] font-medium relative transition-colors ${
          activeTab === 'orders' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <FileText className="w-5 h-5" />
        <span>Pedidos</span>
        {activeOrdersCount > 0 && (
          <span className="absolute -top-1 right-1 bg-brand-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
            {activeOrdersCount}
          </span>
        )}
      </button>
    </nav>
  );
};
