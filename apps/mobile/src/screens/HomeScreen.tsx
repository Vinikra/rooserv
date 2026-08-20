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
  Zap: <Zap className="w-6 h-6 text-amber-500" />,
  Droplets: <Droplets className="w-6 h-6 text-blue-500" />,
  Paintbrush: <Paintbrush className="w-6 h-6 text-purple-500" />,
  Sparkles: <Sparkles className="w-6 h-6 text-emerald-500" />,
  Hammer: <Hammer className="w-6 h-6 text-orange-500" />,
  Fan: <Fan className="w-6 h-6 text-cyan-500" />,
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
    <div className="pb-28 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      {/* Barra de Busca Rápida com Altura Ampla para Celular */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="O que você precisa consertar ou reformar?"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-medium shadow-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Banner de Proteção / Escrow Exclusivo da Cidade */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden space-y-3">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-brand-200">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Garantia RooServ & Pagamento Seguro</span>
          </div>
          <h2 className="text-base sm:text-lg font-black leading-snug">
            Contrate os melhores profissionais de Rondonópolis sem medo de calote.
          </h2>
          <p className="text-xs sm:text-sm text-brand-100/90 leading-relaxed">
            O valor fica protegido pela plataforma e só é repassado ao prestador após sua aprovação final.
          </p>
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="mt-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm px-5 py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
            <span>Pedir Orçamento Grátis</span>
          </button>
        </div>
        <div className="absolute -right-6 -bottom-8 w-40 h-40 bg-brand-600/30 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Ações Rápidas: Indicação & Garantia com Caixas Grandes */}
      <div className="grid grid-cols-2 gap-2.5">
        {onOpenReferral && (
          <button
            type="button"
            onClick={onOpenReferral}
            className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 p-3.5 rounded-2xl flex items-center gap-3 text-left transition-all active:scale-95 shadow-sm"
          >
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-amber-950 block leading-tight">
                Ganhe R$ 20
              </span>
              <span className="text-xs text-amber-900 font-medium">
                Indicar Vizinho
              </span>
            </div>
          </button>
        )}

        {onOpenTerms && (
          <button
            type="button"
            onClick={onOpenTerms}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-3.5 rounded-2xl flex items-center gap-3 text-left transition-all active:scale-95 shadow-sm"
          >
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                Termos & Regras
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Contratação Segura
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Categorias Principais com Ícones e Toques Amplos */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Categorias de Serviços
          </h3>
          {selectedCategorySlug && (
            <button
              type="button"
              onClick={() => setSelectedCategorySlug(null)}
              className="text-xs font-bold text-brand-600 hover:underline bg-brand-50 px-2.5 py-1 rounded-lg"
            >
              Ver todas
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {categories.map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategorySlug(isSelected ? null : cat.slug)}
                className={`p-3.5 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-md ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-slate-100/80 flex items-center justify-center">
                  {ICON_MAP[cat.iconName] || <Zap className="w-6 h-6 text-slate-600" />}
                </div>
                <span className="text-xs font-bold leading-tight line-clamp-2">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Prestadores Verificados com Layout Espaçoso e Legível */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Profissionais em Rondonópolis ({filteredProviders.length})
          </h3>
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
            {selectedNeighborhood}
          </span>
        </div>

        {filteredProviders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
            <p className="text-base font-bold text-slate-800">Nenhum profissional encontrado nesta categoria</p>
            <p className="text-xs text-slate-500">
              Tente selecionar outro bairro ou limpar os filtros de busca.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug(null);
                setSearchTerm('');
              }}
              className="text-xs font-extrabold text-brand-600 bg-brand-50 px-4 py-2.5 rounded-xl border border-brand-200"
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
              className="w-full text-left bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-3"
            >
              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src={provider.profile?.avatarUrl || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150'}
                    alt={provider.profile?.fullName || 'Profissional'}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-xs"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-sm" title="Identidade Verificada">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                      {provider.profile?.fullName || 'Profissional'}
                    </h4>
                    <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-black text-amber-950">
                        {(Number(provider.averageRating) || 5.0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 font-medium mb-1">
                    Bairro: <strong className="text-slate-800">{provider.profile?.neighborhood || 'Centro'}</strong> • {provider.experienceYears || 3} anos de profissão
                  </p>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {provider.bio || 'Profissional com ferramentas próprias e garantia de serviço em Rondonópolis.'}
                  </p>
                </div>
              </div>

              {/* Barra Inferior do Card com Preço e Ação Ampla */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <div className="text-slate-600">
                  <span>Preço estimado: </span>
                  <span className="font-extrabold text-slate-900 text-sm">R$ {provider.hourlyRateEstimate || 80}/h</span>
                </div>

                <div className="flex items-center gap-1.5 text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl font-bold border border-brand-200/80">
                  <span>Ver Detalhes & Portfólio</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Banner de Recrutamento de Profissionais Locais */}
      {onOpenOnboarding && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-5 text-slate-950 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider bg-black/10 px-2.5 py-0.5 rounded-full inline-block">
              Trabalhe Conosco em Rondonópolis
            </span>
            <h4 className="text-sm font-black leading-tight">
              Você é prestador de serviços na cidade?
            </h4>
            <p className="text-xs text-amber-950 font-medium">
              Cadastre-se para receber chamados na Vila Aurora, Centro, Sagrada Família e toda a região.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenOnboarding}
            className="w-full sm:w-auto bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs px-5 py-3 rounded-xl shrink-0 active:scale-95 transition-transform shadow"
          >
            Quero me Cadastrar
          </button>
        </div>
      )}
    </div>
  );
};
