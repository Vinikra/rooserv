import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  MapPin, 
  User, 
  Briefcase, 
  SlidersHorizontal, 
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
    selectedNeighborhood, 
    setSelectedNeighborhood 
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
    <header className="bg-slate-900 text-white pt-3 pb-3 px-4 sticky top-0 z-40 shadow-md border-b border-slate-800">
      {/* Top Bar: Marca RooServ, Cidade e Menu do Usuário */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Logotipo e Cidade */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gradient-to-r from-brand-600 to-indigo-600 px-2.5 py-1 rounded-xl shadow-sm">
            <span className="font-extrabold text-xs tracking-tight text-white">{CITY_CONFIG.brandName}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
            <MapPin className="w-3 h-3 text-brand-400" />
            <span>{`${CITY_CONFIG.name}-${CITY_CONFIG.state}`}</span>
          </div>
        </div>

        {/* Lado Direito: Notificações & Perfil / Login */}
        <div className="flex items-center gap-1.5" ref={menuRef}>
          {/* Botão de Notificações com Badge */}
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors relative active:scale-95"
              title="Notificações"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-slate-900 animate-pulse" />
            </button>
          )}

          {/* Usuário Logado vs Botão Entrar */}
          {isAuthenticated && currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 px-2.5 py-1.5 rounded-xl transition-all active:scale-95 text-left"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.fullName}
                  className="w-6 h-6 rounded-full object-cover border border-slate-600"
                />
                <div className="hidden sm:block">
                  <span className="block text-xs font-bold text-slate-100 max-w-[90px] truncate leading-none">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <span className="block text-[9px] text-brand-300 font-medium">
                    {getRoleLabel()}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {/* Menu Dropdown de Perfil */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in space-y-2.5">
                  {/* Cabeçalho do Menu */}
                  <div className="border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <img
                        src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={currentUser.fullName}
                        className="w-9 h-9 rounded-full object-cover border border-brand-500"
                      />
                      <div className="overflow-hidden">
                        <span className="block text-xs font-bold text-white truncate">
                          {currentUser.fullName}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {currentUser.email}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-900/60 text-brand-300 rounded-md border border-brand-700/50">
                        {getRoleLabel()}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{currentUser.neighborhood}</span>
                      </span>
                    </div>
                  </div>

                  {/* Alternador de Visão para Prestadores */}
                  {currentUser.role === 'provider' && (
                    <div className="bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 space-y-1">
                      <span className="block text-[10px] font-bold text-slate-400 px-1">Alternar Modo:</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentRole('provider');
                            setIsMenuOpen(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            currentRole === 'provider'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Briefcase className="w-3 h-3" />
                          <span>Trabalho</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentRole('client');
                            setIsMenuOpen(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            currentRole === 'client'
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <User className="w-3 h-3" />
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
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          currentRole === 'admin'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" />
                          <span>{currentRole === 'admin' ? 'Ver como Cliente' : 'Painel Administrativo'}</span>
                        </div>
                        <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded">Gestão</span>
                      </button>
                    </div>
                  )}

                  {/* Botão de Logout */}
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 py-2 px-3 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl transition-colors"
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
              className="flex items-center gap-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md transition-all active:scale-95"
              title="Entrar ou Criar Conta"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Bairro da Cidade (Apenas na visão morador/cliente) */}
      {currentRole === 'client' && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1 text-slate-400">
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
            <span>Filtrar Bairro:</span>
          </div>
          <select
            value={selectedNeighborhood}
            onChange={(e) => setSelectedNeighborhood(e.target.value)}
            className="bg-slate-800 text-brand-400 font-semibold border border-slate-700 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="Todos os Bairros">{`Todos os Bairros (${CITY_CONFIG.name})`}</option>
            {CITY_CONFIG.defaultNeighborhoods.map((bairro) => (
              <option key={bairro} value={bairro}>
                {bairro}
              </option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
};
