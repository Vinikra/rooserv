import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  MapPin, 
  User, 
  Briefcase, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  Bell, 
  ChevronDown,
  Compass,
  LogIn, 
  Inbox, 
  Wallet, 
  FileText, 
  MessageSquare,
  Camera,
  Compass,
  PlusCircle
} from 'lucide-react';
import { CITY_CONFIG, UserRole, UserProfile } from '@servicos/shared';

interface HeaderProps {
  onOpenAuth?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

// 1. Navegação Superior para Telas Desktop
const DesktopNav: React.FC<{
  currentRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeOrdersCount: number;
  requestsCount: number;
}> = ({ currentRole, activeTab, setActiveTab, activeOrdersCount, requestsCount }) => {
  if (currentRole === 'client') {
    return (
      <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'explore'
              ? 'bg-brand-600 text-white shadow-sm font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-750'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Explorar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('new_request')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'new_request'
              ? 'bg-brand-600 text-white shadow-sm font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-750'
          }`}
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Pedir Orçamento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold relative transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-brand-600 text-white shadow-sm font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-750'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Meus Pedidos</span>
          {activeOrdersCount > 0 && (
            <span className="bg-brand-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {activeOrdersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'messages'
              ? 'bg-brand-600 text-white shadow-sm font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-750'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Mensagens</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
      <button
        type="button"
        onClick={() => setActiveTab('provider_dashboard')}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          activeTab === 'provider_dashboard'
            ? 'bg-amber-600 text-white shadow-sm font-black'
            : 'text-slate-300 hover:text-white hover:bg-slate-750'
        }`}
      >
        <Wallet className="w-4 h-4" />
        <span>Carteira & Saldo</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('provider_leads')}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold relative transition-all flex items-center gap-1.5 cursor-pointer ${
          activeTab === 'provider_leads'
            ? 'bg-amber-600 text-white shadow-sm font-black'
            : 'text-slate-300 hover:text-white hover:bg-slate-750'
        }`}
      >
        <Inbox className="w-4 h-4" />
        <span>Oportunidades</span>
        {requestsCount > 0 && (
          <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
            {requestsCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('orders')}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold relative transition-all flex items-center gap-1.5 cursor-pointer ${
          activeTab === 'orders'
            ? 'bg-amber-600 text-white shadow-sm font-black'
            : 'text-slate-300 hover:text-white hover:bg-slate-750'
        }`}
      >
        <FileText className="w-4 h-4" />
        <span>Serviços</span>
        {activeOrdersCount > 0 && (
          <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
            {activeOrdersCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('messages')}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          activeTab === 'messages'
            ? 'bg-amber-600 text-white shadow-sm font-black'
            : 'text-slate-300 hover:text-white hover:bg-slate-750'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>Chat</span>
      </button>
    </nav>
  );
};

// 2. Dropdown do Menu do Usuário
const UserDropdownMenu: React.FC<{
  currentUser: UserProfile;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  isAdmin: boolean;
  onLogout: () => void;
  onClose: () => void;
  onOpenProfile?: () => void;
  roleLabel: string;
}> = ({ currentUser, currentRole, setCurrentRole, isAdmin, onLogout, onClose, onOpenProfile, roleLabel }) => {
  return (
    <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in space-y-3">
      <div className="border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <img
            src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={currentUser.fullName}
            className="w-11 h-11 rounded-full object-cover border-2 border-brand-500"
          />
          <div className="overflow-hidden">
            <span className="block text-sm font-bold text-white truncate">
              {currentUser.fullName}
            </span>
            <span className="block text-xs text-slate-400 truncate">
              {currentUser.email}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-xs font-extrabold px-2.5 py-0.5 bg-brand-900/80 text-brand-300 rounded-lg border border-brand-700/50">
            {roleLabel}
          </span>
          <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentUser.neighborhood}</span>
          </span>
        </div>
      </div>

      {/* Botão de Customização de Perfil */}
      {onOpenProfile && (
        <div>
          <button
            type="button"
            onClick={() => {
              onOpenProfile();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 py-2.5 px-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-700/60"
          >
            <Camera className="w-4 h-4 text-brand-400" />
            <span>Editar Meu Perfil & Foto</span>
          </button>
        </div>
      )}

      {currentUser.role === 'provider' && (
        <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700/80 space-y-1.5">
          <span className="block text-xs font-bold text-slate-300 px-1">Alternar Modo:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCurrentRole('provider');
                onClose();
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentRole === 'provider'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Trabalho</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentRole('client');
                onClose();
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentRole === 'client'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Contratar</span>
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              setCurrentRole(currentRole === 'admin' ? 'client' : 'admin');
              onClose();
            }}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between cursor-pointer ${
              currentRole === 'admin'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{currentRole === 'admin' ? 'Ver como Cliente' : 'Painel de Gestão Admin'}</span>
            </div>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded font-bold">Gestão</span>
          </button>
        </div>
      )}

      <div className="pt-1.5 border-t border-slate-800">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 py-2.5 px-3 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );
};

// 3. Componente Principal Header
export const Header: React.FC<HeaderProps> = ({ 
  onOpenAuth, 
  onOpenNotifications,
  onOpenProfile,
  activeTab = 'explore',
  setActiveTab
}) => {
  const { 
    currentRole, 
    setCurrentRole, 
    currentUser, 
    isAuthenticated, 
    isAdmin, 
    logout,
    unreadNotificationsCount,
    orders,
    requests
  } = useApp();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeOrdersCount = orders.filter(
    (o) => o.status === 'payment_in_escrow' || o.status === 'completed_by_provider'
  ).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrador';
    if (currentUser?.role === 'provider') return 'Prestador';
    return 'Morador';
  };

  return (
    <header className="bg-slate-900 text-white pt-safe pb-3.5 px-4 sm:px-6 lg:px-8 sticky top-0 z-40 shadow-md border-b border-slate-800 transition-all">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        {/* Logotipo e Cidade */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab?.('explore')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 px-3.5 py-1.5 rounded-xl shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
          >
            <span className="font-black text-sm sm:text-base tracking-tight text-white">{CITY_CONFIG.brandName}</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-200 font-semibold bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-brand-400" />
            <span>{`${CITY_CONFIG.name}-${CITY_CONFIG.state}`}</span>
          </div>
        </div>

        {/* Navegação Desktop */}
        {setActiveTab && currentRole !== 'admin' && (
          <DesktopNav
            currentRole={currentRole}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeOrdersCount={activeOrdersCount}
            requestsCount={requests.length}
          />
        )}

        {/* Lado Direito: Notificações & Perfil */}
        <div className="flex items-center gap-2.5" ref={menuRef}>
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors relative active:scale-95 cursor-pointer"
              title="Notificações"
            >
              <Bell className="w-5 h-5 text-indigo-400" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-indigo-500 text-white text-[10px] rounded-full flex items-center justify-center font-black border-2 border-slate-900 px-1">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {isAuthenticated && currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl transition-all active:scale-95 text-left cursor-pointer"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.fullName}
                  className="w-7 h-7 rounded-full object-cover border border-brand-400 shrink-0"
                />
                <div className="hidden sm:block">
                  <span className="block text-xs font-extrabold text-slate-100 max-w-[110px] truncate leading-none">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <span className="block text-[11px] text-brand-300 font-bold mt-0.5">
                    {getRoleLabel()}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
              </button>

              {isMenuOpen && (
                <UserDropdownMenu
                  currentUser={currentUser}
                  currentRole={currentRole}
                  setCurrentRole={setCurrentRole}
                  isAdmin={isAdmin}
                  onLogout={handleLogout}
                  onClose={() => setIsMenuOpen(false)}
                  onOpenProfile={onOpenProfile}
                  roleLabel={getRoleLabel()}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              title="Entrar ou Criar Conta"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
