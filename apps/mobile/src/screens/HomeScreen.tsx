import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProviderProfile } from '@servicos/shared';
import { 
  Search, 
  Star, 
  ShieldCheck, 
  Zap, 
  Droplets, 
  Paintbrush, 
  Sparkles, 
  Hammer, 
  Fan, 
  ChevronRight, 
  CheckCircle2, 
  Flame, 
  Gift, 
  FileText 
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-5 h-5 text-amber-500" />,
  Droplets: <Droplets className="w-5 h-5 text-blue-500" />,
  Paintbrush: <Paintbrush className="w-5 h-5 text-purple-500" />,
  Sparkles: <Sparkles className="w-5 h-5 text-emerald-500" />,
  Hammer: <Hammer className="w-5 h-5 text-orange-500" />,
  Fan: <Fan className="w-5 h-5 text-cyan-500" />,
};

interface HomeScreenProps {
  onSelectProvider: (provider: ProviderProfile) => void;
  onOpenNewRequest: () => void;
  onOpenOnboarding?: () => void;
  onOpenReferral?: () => void;
  onOpenTerms?: () => void;
}

function matchesSearch(provider: ProviderProfile, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  const nameMatch = (provider.profile?.fullName || '').toLowerCase().includes(lower);
  const bioMatch = (provider.bio || '').toLowerCase().includes(lower);
  const catMatch = (provider.categories || []).some((c) => (c?.name || '').toLowerCase().includes(lower));
  return nameMatch || bioMatch || catMatch;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
  onSelectProvider, 
  onOpenNewRequest, 
  onOpenOnboarding, 
  onOpenReferral, 
  onOpenTerms 
}) => {
  const { 
    categories, 
    providers, 
    selectedNeighborhood, 
    selectedCategorySlug, 
    setSelectedCategorySlug 
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  // Filtragem limpa e otimizada
  const filteredProviders = (providers || []).filter((p) => {
    if (p?.verificationStatus !== 'verified') return false;
    if (selectedNeighborhood !== 'Todos os Bairros' && p.profile?.neighborhood !== selectedNeighborhood) return false;
    if (selectedCategorySlug && !(p.categories || []).some((c) => c?.slug === selectedCategorySlug)) return false;
    return matchesSearch(p, searchTerm.trim());
  });

  return (
    <div className="pb-24 pt-2 px-4 space-y-4">
      {/* Barra de Busca Rápida */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="O que você precisa consertar ou reformar?"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Banner de Proteção / Escrow Exclusivo da Cidade */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-brand-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-200 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Garantia & Pagamento Seguro</span>
          </div>
          <h2 className="text-base font-bold leading-tight mb-1">
            Contrate os melhores profissionais da cidade sem medo de calote.
          </h2>
          <p className="text-xs text-brand-100/90 mb-3">
            O dinheiro só é repassado ao prestador após você aprovar o serviço concluído.
          </p>
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Solicitar Orçamento Grátis</span>
          </button>
        </div>
        <div className="absolute -right-4 -bottom-6 w-32 h-32 bg-brand-600/30 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Ações Rápidas: Indicação & Garantia */}
      <div className="grid grid-cols-2 gap-2">
        {onOpenReferral && (
          <button
            type="button"
            onClick={onOpenReferral}
            className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2 text-left transition-all active:scale-95 shadow-xs"
          >
            <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-950 block leading-tight">
                Ganhe R$ 20
              </span>
              <span className="text-[10px] text-amber-800">
                Indique um Vizinho
              </span>
            </div>
          </button>
        )}

        {onOpenTerms && (
          <button
            type="button"
            onClick={onOpenTerms}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2 text-left transition-all active:scale-95 shadow-xs"
          >
            <div className="p-2 bg-slate-900 text-white rounded-lg shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block leading-tight">
                Garantia & Termos
              </span>
              <span className="text-[10px] text-slate-500">
                Regras & Proteção
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Categorias Principais em Grid Horizontal */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Categorias em Destaque
          </h3>
          {selectedCategorySlug && (
            <button
              type="button"
              onClick={() => setSelectedCategorySlug(null)}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategorySlug(isSelected ? null : cat.slug)}
                className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-100 flex items-center justify-center">
                  {ICON_MAP[cat.iconName] || <Zap className="w-5 h-5 text-slate-600" />}
                </div>
                <span className="text-xs font-semibold leading-tight line-clamp-2">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Prestadores Verificados */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Profissionais Verificados ({filteredProviders.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            {selectedNeighborhood}
          </span>
        </div>

        {filteredProviders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
            <p className="text-sm font-semibold text-slate-700 mb-1">Nenhum profissional encontrado</p>
            <p className="text-xs text-slate-500 mb-4">
              Tente selecionar outro bairro ou limpar o filtro de busca.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug(null);
                setSearchTerm('');
              }}
              className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          filteredProviders.map((provider) => (
            <button
              type="button"
              key={provider.id}
              onClick={() => onSelectProvider(provider)}
              className="w-full text-left bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={provider.profile?.avatarUrl || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150'}
                    alt={provider.profile?.fullName || 'Profissional'}
                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-100"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5" title="Identidade Verificada">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                      {provider.profile?.fullName || 'Profissional'}
                    </h4>
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-amber-900">
                        {(Number(provider.averageRating) || 5.0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-1">
                    Bairro: <strong className="text-slate-700">{provider.profile?.neighborhood || 'Centro'}</strong> • {provider.experienceYears || 3} anos de exp.
                  </p>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-2.5">
                    {provider.bio || 'Profissional disponível em Rondonópolis.'}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="text-slate-500">
                      Preço base: <span className="font-bold text-slate-900">R$ {provider.hourlyRateEstimate || 80}/h</span>
                    </div>

                    <div className="flex items-center gap-1 text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Ver Perfil & Portfólio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Banner de Recrutamento de Profissionais Locais */}
      {onOpenOnboarding && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-slate-950 shadow-md flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded-full inline-block mb-1">
              Trabalhe Conosco em Rondonópolis
            </span>
            <h4 className="text-xs font-black leading-tight">
              Você é prestador de serviços na cidade?
            </h4>
            <p className="text-[11px] text-amber-950/80 font-medium">
              Cadastre-se para receber pedidos na Vila Aurora, Centro e outros bairros.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenOnboarding}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shrink-0 active:scale-95 transition-transform shadow"
          >
            Cadastrar-se
          </button>
        </div>
      )}
    </div>
  );
};
