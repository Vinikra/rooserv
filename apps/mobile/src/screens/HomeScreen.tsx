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
  GraduationCap,
  BookOpen,
  Calculator,
  ChevronRight, 
  CheckCircle2, 
  Flame, 
  Gift, 
  FileText 
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  GraduationCap: <GraduationCap className="w-6 h-6 text-indigo-500" />,
  BookOpen: <BookOpen className="w-6 h-6 text-indigo-500" />,
  Calculator: <Calculator className="w-6 h-6 text-indigo-500" />,
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
    selectedCategorySlug, 
    setSelectedCategorySlug 
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  // Filtragem limpa por categoria e termo de busca para Rondonópolis
  const filteredProviders = (providers || []).filter((p) => {
    if (p?.verificationStatus !== 'verified') return false;
    if (selectedCategorySlug && !(p.categories || []).some((c) => c?.slug === selectedCategorySlug)) return false;
    return matchesSearch(p, searchTerm.trim());
  });

  return (
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Barra de Busca Rápida com Centralização Ampla */}
      <div className="max-w-3xl mx-auto w-full relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="O que você precisa consertar, instalar ou reformar hoje em Rondonópolis?"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white pl-12 pr-4 py-4 rounded-2xl border border-slate-200 text-sm sm:text-base font-medium shadow-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
        />
      </div>

      {/* Grid Superior: Banner de Garantia & Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Banner de Proteção / Escrow Exclusivo da Cidade */}
        <div className="lg:col-span-2 bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden flex flex-col justify-between space-y-4">
          <div className="relative z-10 space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-extrabold text-brand-200">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Garantia RooServ & Pagamento Seguro</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black leading-snug">
              Contrate os melhores profissionais da cidade sem medo de calote.
            </h2>
            <p className="text-xs sm:text-sm text-brand-100/90 leading-relaxed">
              O valor fica protegido sob custódia pela plataforma e só é transferido ao prestador após sua aprovação final.
            </p>
          </div>

          <div className="relative z-10 pt-2">
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
            >
              <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>Pedir Orçamento Grátis na Cidade</span>
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 w-52 h-52 bg-brand-600/30 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Ações Rápidas: Indicação & Garantia */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-between">
          {onOpenReferral && (
            <button
              type="button"
              onClick={onOpenReferral}
              className="flex-1 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 p-4 rounded-3xl flex items-center gap-3.5 text-left transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shrink-0">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-black text-amber-950 block leading-tight">
                  Ganhe R$ 20 de Desconto
                </span>
                <span className="text-xs text-amber-900 font-medium">
                  Indique um vizinho de condomínio ou bairro
                </span>
              </div>
            </button>
          )}

          {onOpenTerms && (
            <button
              type="button"
              onClick={onOpenTerms}
              className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-3xl flex items-center gap-3.5 text-left transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <div className="p-3 bg-slate-900 text-white rounded-2xl shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 block leading-tight">
                  Regras de Proteção & Custódia
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Termos e cobertura de 60 dias
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Categorias de Serviços com Grid Fluido Desktop (6 Colunas) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-wider">
            Categorias de Serviços
          </h3>
          {selectedCategorySlug && (
            <button
              type="button"
              onClick={() => setSelectedCategorySlug(null)}
              className="text-xs sm:text-sm font-bold text-brand-600 hover:underline bg-brand-50 px-3 py-1 rounded-xl cursor-pointer"
            >
              Ver todas as categorias
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategorySlug(isSelected ? null : cat.slug)}
                className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-2.5 transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-md ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50/80 shadow-xs'
                }`}
              >
                <div className="p-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                  {ICON_MAP[cat.iconName] || <Zap className="w-6 h-6 text-slate-600" />}
                </div>
                <span className="text-xs sm:text-sm font-bold leading-tight line-clamp-2">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Prestadores Verificados em Grid Desktop (2 a 3 Colunas) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-wider">
            Profissionais Disponíveis em Rondonópolis ({filteredProviders.length})
          </h3>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/60">
            Atende toda a cidade
          </span>
        </div>

        {filteredProviders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
            <p className="text-base sm:text-lg font-bold text-slate-800">Nenhum profissional encontrado nesta busca</p>
            <p className="text-xs sm:text-sm text-slate-500">
              Tente limpar os filtros de busca ou selecionar outra categoria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug(null);
                setSearchTerm('');
              }}
              className="text-xs sm:text-sm font-extrabold text-brand-600 bg-brand-50 px-5 py-2.5 rounded-xl border border-brand-200 cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProviders.map((provider) => (
              <button
                type="button"
                key={provider.id}
                onClick={() => onSelectProvider(provider)}
                className="w-full text-left bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
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
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
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
                        Base: <strong className="text-slate-800">{provider.profile?.neighborhood || 'Centro'}</strong> • {provider.experienceYears || 3} anos de exp.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {provider.bio || 'Profissional com ferramentas próprias e garantia de serviço em Rondonópolis.'}
                  </p>

                  {/* Badges de Confiança & Gamificação AAA */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(Number(provider.averageRating) || 5.0) >= 4.8 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-200">
                        <span>🏅 Super Prestador</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Garantia 60 Dias</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-200">
                      <Zap className="w-3 h-3 text-blue-600" />
                      <span>Resposta Rápida</span>
                    </span>
                  </div>
                </div>

                {/* Barra Inferior do Card com Preço e Ação Ampla */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div className="text-slate-600">
                    <span>Preço base: </span>
                    <span className="font-extrabold text-slate-900 text-sm">R$ {provider.hourlyRateEstimate || 80}/h</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl font-bold border border-brand-200/80 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <span>Ver Perfil</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Banner de Recrutamento de Profissionais Locais */}
      {onOpenOnboarding && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-6 text-slate-950 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider bg-black/10 px-2.5 py-0.5 rounded-full inline-block">
              Trabalhe Conosco em Rondonópolis
            </span>
            <h4 className="text-base font-black leading-tight">
              Você é prestador de serviços na cidade?
            </h4>
            <p className="text-xs sm:text-sm text-amber-950 font-medium">
              Cadastre-se para receber chamados na Vila Aurora, Centro, Sagrada Família e todos os bairros da cidade.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenOnboarding}
            className="w-full sm:w-auto bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-xl shrink-0 active:scale-95 transition-transform shadow cursor-pointer"
          >
            Quero me Cadastrar
          </button>
        </div>
      )}
    </div>
  );
};
