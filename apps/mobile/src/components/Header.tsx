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
  ChevronDown
} from 'lucide-react';
import { CITY_CONFIG } from '@servicos/shared';

interface HeaderProps {
  onOpenAuth?: () => void;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth, onOpenNotifications }) => {
  const { 
    currentRole, 
    setCurrentRole, 
    currentUser, 
    isAuthenticated, 
    isAdmin, 
    logout,
    unreadNotificationsCount
  } = useApp();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown de perfil se o usuário clicar fora
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
    <header className="bg-slate-900 text-white pt-3.5 pb-3.5 px-4 sticky top-0 z-40 shadow-md border-b border-slate-800">
      {/* Top Bar: Marca RooServ, Cidade e Menu do Usuário */}
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        {/* Logotipo e Cidade */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gradient-to-r from-brand-600 to-indigo-600 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="font-black text-sm tracking-tight text-white">{CITY_CONFIG.brandName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-200 font-semibold bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-brand-400" />
            <span>{`${CITY_CONFIG.name}-${CITY_CONFIG.state}`}</span>
          </div>
        </div>

        {/* Lado Direito: Notificações & Perfil / Login */}
        <div className="flex items-center gap-2" ref={menuRef}>
          {/* Botão de Notificações com Badge Dinâmica */}
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors relative active:scale-95"
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

          {/* Usuário Logado vs Botão Entrar */}
          {isAuthenticated && currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl transition-all active:scale-95 text-left"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.fullName}
                  className="w-7 h-7 rounded-full object-cover border border-brand-400 shrink-0"
                />
                <div className="hidden sm:block">
                  <span className="block text-xs font-extrabold text-slate-100 max-w-[100px] truncate leading-none">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <span className="block text-[11px] text-brand-300 font-bold mt-0.5">
                    {getRoleLabel()}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
              </button>

              {/* Menu Dropdown de Perfil */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in space-y-3">
                  {/* Cabeçalho do Menu */}
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
                        {getRoleLabel()}
                      </span>
                      <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{currentUser.neighborhood}</span>
                      </span>
                    </div>
                  </div>

                  {/* Alternador de Visão para Prestadores */}
                  {currentUser.role === 'provider' && (
                    <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700/80 space-y-1.5">
                      <span className="block text-xs font-bold text-slate-300 px-1">Alternar Modo:</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentRole('provider');
                            setIsMenuOpen(false);
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
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
                            setIsMenuOpen(false);
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
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

                  {/* Acesso ao Painel Admin se for Administrador */}
                  {isAdmin && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentRole(currentRole === 'admin' ? 'client' : 'admin');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between ${
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

                  {/* Botão de Logout */}
                  <div className="pt-1.5 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 py-2.5 px-3 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Botão de Entrar para Visitantes */
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
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
