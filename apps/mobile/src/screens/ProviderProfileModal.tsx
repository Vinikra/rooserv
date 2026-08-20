import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProviderProfile } from '@servicos/shared';
import { 
  X, 
  Star, 
  ShieldCheck, 
  CheckCircle, 
  MapPin, 
  ArrowRight, 
  MessageSquare 
} from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header do Modal com Capa e Botão Fechar */}
        <div className="relative bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 p-5 sm:p-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4 mt-2">
            <div className="relative shrink-0">
              <img
                src={provider.profile?.avatarUrl}
                alt={provider.profile?.fullName}
                className="w-18 h-18 rounded-2xl object-cover border-2 border-white shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-sm">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-black leading-tight truncate">
                {provider.profile?.fullName}
              </h3>
              <p className="text-xs sm:text-sm text-brand-200 flex items-center gap-1.5 mt-1 font-medium">
                <MapPin className="w-4 h-4 text-brand-400 shrink-0" />
                <span>{`${provider.profile?.neighborhood} • ${provider.experienceYears} anos de exp.`}</span>
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 bg-amber-400/25 px-2.5 py-1 rounded-lg text-amber-300 text-xs font-black">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{(Number(provider.averageRating) || 5.0).toFixed(1)}</span>
                  <span className="text-white/80 font-normal">({provider.totalReviews || 0})</span>
                </div>

                <div className="flex items-center gap-1 bg-emerald-500/25 px-2.5 py-1 rounded-lg text-emerald-300 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verificado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Abas Internas com Área de Toque Confortável */}
        <div className="flex border-b border-slate-200 px-3 bg-slate-50 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('sobre')}
            className={`py-3.5 px-3 border-b-2 transition-colors flex-1 text-center ${
              activeTab === 'sobre'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sobre
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('portfolio')}
            className={`py-3.5 px-3 border-b-2 transition-colors flex-1 text-center ${
              activeTab === 'portfolio'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {`Fotos (${provider.portfolio?.length || 0})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('avaliacoes')}
            className={`py-3.5 px-3 border-b-2 transition-colors flex-1 text-center ${
              activeTab === 'avaliacoes'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {`Avaliações (${providerReviews.length})`}
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm text-slate-700">
          {activeTab === 'sobre' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider mb-2">
                  Biografia & Especialidades
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 font-medium">
                  {provider.bio}
                </p>
              </div>

              {/* Selo de Garantia do App */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-black text-emerald-950">
                    Contratação Segura com Custódia RooServ
                  </h5>
                  <p className="text-xs text-emerald-800 leading-relaxed mt-1 font-medium">
                    Você pode pagar no Pix ou parcelar em até 12x no cartão. O valor fica retido com segurança na plataforma e só é repassado ao prestador após sua aprovação final.
                  </p>
                </div>
              </div>

              {/* Informações Rápidas */}
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block text-xs font-semibold">Média de Preço</span>
                  <strong className="text-base font-black text-slate-900">{`R$ ${provider.hourlyRateEstimate}/hora`}</strong>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block text-xs font-semibold">Serviços Concluídos</span>
                  <strong className="text-base font-black text-slate-900">{`${provider.totalCompletedOrders} no app`}</strong>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="space-y-4">
              {!provider.portfolio || provider.portfolio.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm font-medium">
                  Nenhuma foto de portfólio cadastrada ainda.
                </div>
              ) : (
                (provider.portfolio || []).map((item) => (
                  <div key={item.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
                    <h5 className="text-sm font-extrabold text-slate-900">{item.title}</h5>
                    <p className="text-xs text-slate-600 font-medium">{item.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      {item.beforeImageUrl && (
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Antes</span>
                          <img
                            src={item.beforeImageUrl}
                            alt="Antes"
                            className="w-full h-32 object-cover rounded-xl border border-slate-200"
                          />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-emerald-700 uppercase block mb-1">Depois</span>
                        <img
                          src={item.afterImageUrl}
                          alt="Depois"
                          className="w-full h-32 object-cover rounded-xl border border-emerald-300 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'avaliacoes' && (
            <div className="space-y-3.5">
              {providerReviews.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm font-medium">
                  Nenhuma avaliação registrada ainda.
                </div>
              ) : (
                providerReviews.map((rev) => (
                  <div key={rev.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900">
                        {rev.client?.fullName || 'Cliente da Cidade'}
                      </span>
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].slice(0, rev.rating).map((starVal) => (
                          <Star key={`rating-star-${rev.id}-${starVal}`} className="w-4 h-4 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-medium">
                      {`"${rev.comment}"`}
                    </p>

                    {rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rev.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg font-semibold"
                          >
                            {`✓ ${tag}`}
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

        {/* Footer com Ações de Chat e Contratação em 52px */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChat(provider)}
            className="py-4 px-5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl transition-all font-black text-sm flex items-center justify-center gap-2 active:scale-95 border border-slate-200 shrink-0"
            title="Tirar dúvidas e pedir orçamento no Chat"
          >
            <MessageSquare className="w-5 h-5 text-brand-600" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onStartCheckout(provider)}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>{`Contratar (R$ ${provider.hourlyRateEstimate})`}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
