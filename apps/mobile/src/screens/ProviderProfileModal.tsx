import React, { useState } from 'react';
import { ProviderProfile } from '@servicos/shared';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Star, 
  ShieldCheck, 
  Award, 
  CheckCircle, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Sparkles, 
  ThumbsUp, 
  MessageSquare 
} from 'lucide-react';
import { formatCurrencyBRL } from '@servicos/shared';

interface ProviderProfileModalProps {
  provider: ProviderProfile | null;
  onClose: () => void;
  onStartCheckout: (provider: ProviderProfile) => void;
  onOpenChat: (provider: ProviderProfile) => void;
}

export const ProviderProfileModal: React.FC<ProviderProfileModalProps> = ({
  provider,
  onClose,
  onStartCheckout,
  onOpenChat,
}) => {
  const { reviews } = useApp();
  const [activeTab, setActiveTab] = useState<'sobre' | 'portfolio' | 'avaliacoes'>('sobre');

  if (!provider) return null;

  const providerReviews = reviews.filter((r) => r.providerId === provider.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header do Modal com Capa e Botão Fechar */}
        <div className="relative bg-gradient-to-r from-brand-900 to-slate-900 p-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 mt-2">
            <div className="relative">
              <img
                src={provider.profile?.avatarUrl}
                alt={provider.profile?.fullName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold leading-tight">
                  {provider.profile?.fullName}
                </h3>
              </div>
              <p className="text-xs text-brand-200 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {provider.profile?.neighborhood} • {provider.experienceYears} anos de profissão
              </p>
              
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1 bg-amber-400/20 px-2 py-0.5 rounded-md text-amber-300 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{(Number(provider.averageRating) || 5.0).toFixed(1)}</span>
                  <span className="text-white/70 font-normal">({provider.totalReviews || 0} avaliações)</span>
                </div>

                <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded-md text-emerald-300 text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Identidade Verificada</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Abas Internas */}
        <div className="flex border-b border-slate-200 px-4 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sobre')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'sobre'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sobre o Profissional
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'portfolio'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Antes & Depois ({provider.portfolio?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('avaliacoes')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'avaliacoes'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Avaliações Reais ({providerReviews.length})
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm text-slate-700">
          {activeTab === 'sobre' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Biografia & Especialidades
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  {provider.bio}
                </p>
              </div>

              {/* Selo de Garantia do App */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-emerald-900">
                    Contratação Segura com Custódia
                  </h5>
                  <p className="text-[11px] text-emerald-700 leading-normal mt-0.5">
                    Você pode parcelar em até 12x. O dinheiro fica 100% protegido na plataforma e só é repassado ao profissional depois que você aprovar o serviço finalizado.
                  </p>
                </div>
              </div>

              {/* Informações Rápidas */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Média de Preço</span>
                  <strong className="text-sm text-slate-900">R$ {provider.hourlyRateEstimate}/hora</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Serviços Concluídos</span>
                  <strong className="text-sm text-slate-900">{provider.totalCompletedOrders} no app</strong>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="space-y-4">
              {!provider.portfolio || provider.portfolio.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhuma foto de portfólio cadastrada ainda.
                </div>
              ) : (
                (provider.portfolio || []).map((item) => (
                  <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                    <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                    <p className="text-[11px] text-slate-600">{item.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {item.beforeImageUrl && (
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Antes</span>
                          <img
                            src={item.beforeImageUrl}
                            alt="Antes"
                            className="w-full h-28 object-cover rounded-lg border border-slate-200"
                          />
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-semibold text-emerald-600 uppercase block mb-1">Depois</span>
                        <img
                          src={item.afterImageUrl}
                          alt="Depois"
                          className="w-full h-28 object-cover rounded-lg border border-emerald-300 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'avaliacoes' && (
            <div className="space-y-3">
              {providerReviews.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhuma avaliação registrada ainda.
                </div>
              ) : (
                providerReviews.map((rev) => (
                  <div key={rev.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {rev.client?.fullName || 'Cliente da Cidade'}
                      </span>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{rev.comment}"
                    </p>

                    {rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rev.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer com Ações de Chat e Contratação */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2.5">
          <button
            onClick={() => onOpenChat(provider)}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 border border-slate-200"
            title="Tirar dúvidas e pedir orçamento no Chat"
          >
            <MessageSquare className="w-4 h-4 text-brand-600" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onStartCheckout(provider)}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Contratar (R$ {provider.hourlyRateEstimate})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
