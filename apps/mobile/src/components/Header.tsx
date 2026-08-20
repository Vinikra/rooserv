import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  MapPin, 
  User, 
  Briefcase, 
  SlidersHorizontal, 
  Building2, 
  LogIn, 
  Bell 
} from 'lucide-react';
import { CITY_CONFIG } from '@servicos/shared';

interface HeaderProps {
  onOpenAuth?: () => void;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth, onOpenNotifications }) => {
  const { currentRole, setCurrentRole, selectedNeighborhood, setSelectedNeighborhood } = useApp();

  return (
    <header className="bg-slate-900 text-white pt-3 pb-3 px-4 sticky top-0 z-40 shadow-md border-b border-slate-800">
      {/* Top Bar: Marca RooServ e Seletor de Perfil */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gradient-to-r from-brand-600 to-indigo-600 px-2.5 py-1 rounded-xl shadow-sm">
            <span className="font-extrabold text-xs tracking-tight text-white">{CITY_CONFIG.brandName}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
            <MapPin className="w-3 h-3 text-brand-400" />
            <span>{CITY_CONFIG.name}-{CITY_CONFIG.state}</span>
          </div>
        </div>

        {/* Simulador de Papéis (Alternador de visão) */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
          <button
            onClick={() => setCurrentRole('client')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              currentRole === 'client'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Visão do Morador / Contratante"
          >
            <User className="w-3 h-3" />
            <span className="hidden sm:inline">Cliente</span>
          </button>

          <button
            onClick={() => setCurrentRole('provider')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              currentRole === 'provider'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Visão do Eletricista / Diarista / Prestador"
          >
            <Briefcase className="w-3 h-3" />
            <span className="hidden sm:inline">Prestador</span>
          </button>

          <button
            onClick={() => setCurrentRole('admin')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              currentRole === 'admin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Painel do Dono da Plataforma"
          >
            <Building2 className="w-3 h-3" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Botão de Notificações com Badge */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors relative"
              title="Notificações"
            >
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-slate-900 animate-pulse" />
            </button>
          )}

          {/* Botão de Autenticação */}
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
              title="Entrar ou Criar Conta"
            >
              <LogIn className="w-3.5 h-3.5 text-brand-400" />
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Bairro da Cidade (Apenas na visão cliente) */}
      {currentRole === 'client' && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1 text-slate-400">
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
            <span>Filtrar Bairro:</span>
          </div>

          <select
            value={selectedNeighborhood}
            onChange={(e) => setSelectedNeighborhood(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs px-2 py-0.5 rounded border border-slate-700 focus:outline-none focus:border-brand-500"
          >
            <option value="Todos os Bairros">Todos os Bairros ({CITY_CONFIG.estimatedPopulation.toLocaleString('pt-BR')} hab)</option>
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
