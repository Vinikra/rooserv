import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Clock, 
  RotateCcw, 
  Scale,
  ShieldCheck,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { formatCurrencyBRL, CITY_CONFIG } from '@servicos/shared';

export const AdminScreen: React.FC = () => {
  const { 
    providers, 
    orders, 
    verifyProviderByAdmin, 
    resolveDisputeByAdmin, 
    getAdminStats,
    isAdmin,
    loginAsAdmin,
    setCurrentRole
  } = useApp();

  const [adminPin, setAdminPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError(null);

    const res = await loginAsAdmin(adminPin);
    setIsVerifying(false);

    if (!res.success) {
      setAuthError(res.error || 'Chave administrativa incorreta.');
    }
  };

  // Se o usuário não for administrador, exibe barreira de segurança
  if (!isAdmin) {
    return (
      <div className="pb-24 pt-6 px-4 max-w-md mx-auto space-y-6 animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
            <KeyRound className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Painel de Gestão RooServ
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Esta área é restrita aos proprietários e administradores da plataforma em Rondonópolis.
            </p>
          </div>

          <form onSubmit={handleAdminUnlock} className="space-y-3 pt-2 text-left">
            <div>
              <label htmlFor="admin-pin-input" className="block text-xs font-bold text-slate-700 mb-1">
                Chave Master ou Senha de Gestão
              </label>
              <input
                id="admin-pin-input"
                type="password"
                required
                placeholder="Insira a chave master"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {authError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isVerifying ? (
                <span>Validando...</span>
              ) : (
                <>
                  <span>Desbloquear Painel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentRole('client')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1"
            >
              Voltar para o aplicativo
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = getAdminStats();

  const pendingProviders = providers.filter(
    (p) => p.verificationStatus === 'under_review' || p.verificationStatus === 'pending'
  );

  const disputedOrders = orders.filter((o) => o.status === 'disputed');

  return (
    <div className="pb-24 pt-3 px-4 space-y-5 max-w-2xl mx-auto">
      {/* Header do Painel */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Painel do Dono da Plataforma</span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {`${CITY_CONFIG.name} (${CITY_CONFIG.estimatedPopulation.toLocaleString('pt-BR')} hab)`}
          </h2>
        </div>

        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">
          Taxa Fixa: 12%
        </span>
      </div>

      {/* Grid de Métricas Financeiras */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Receita da Plataforma (12%) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Sua Receita Líquida</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg font-extrabold text-emerald-600">
            {formatCurrencyBRL(stats.platformRevenue)}
          </h3>
          <span className="text-[10px] text-slate-400 block">Comissões de 12% retidas</span>
        </div>

        {/* Volume Total Transacionado (GMV) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Volume Total (GMV)</span>
            <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            {formatCurrencyBRL(stats.totalVolumeTransacted)}
          </h3>
          <span className="text-[10px] text-slate-400 block">Serviços contratados</span>
        </div>

        {/* Dinheiro Retido em Custódia Segura */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Em Custódia Segura</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg font-extrabold text-amber-600">
            {formatCurrencyBRL(stats.inEscrowAmount)}
          </h3>
          <span className="text-[10px] text-slate-400 block">Aguardando aprovação do morador</span>
        </div>
      </div>

      {/* Disputas & Mediações em Aberto */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Arbitragem de Disputas ({disputedOrders.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Você tem poder de decisão final</span>
        </div>

        {disputedOrders.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex flex-col items-center gap-1">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span>Nenhuma disputa pendente em Rondonópolis!</span>
          </div>
        ) : (
          disputedOrders.map((ord) => (
            <div
              key={ord.id}
              className="bg-red-50/60 border border-red-200 rounded-xl p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Pedido #{ord.orderNumber} • {formatCurrencyBRL(ord.totalAmount)}
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Cliente: {ord.client?.fullName} • Prestador: {ord.provider?.profile?.fullName}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                  Disputa Ativa
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-red-100 text-xs space-y-1">
                <span className="font-bold text-red-900 block">Motivo: {ord.disputeReason}</span>
                <p className="text-slate-600 text-[11px]">{ord.disputeDetails}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => resolveDisputeByAdmin(ord.id, 'refund_client')}
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Estornar para Morador</span>
                </button>

                <button
                  type="button"
                  onClick={() => resolveDisputeByAdmin(ord.id, 'release_provider')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Liberar para Prestador</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fila de Verificação de Prestadores (KYC) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Aprovação de Prestadores ({pendingProviders.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Verificação de Documentos e Selo</span>
        </div>

        {pendingProviders.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
            Todos os prestadores cadastrados estão revisados.
          </div>
        ) : (
          pendingProviders.map((provider) => (
            <div
              key={provider.id}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={provider.profile?.avatarUrl}
                    alt={provider.profile?.fullName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-300"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {provider.profile?.fullName}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {provider.profile?.neighborhood} • {provider.experienceYears} anos de experiência
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  Em Análise
                </span>
              </div>

              <p className="text-xs text-slate-600 italic">
                "{provider.bio}"
              </p>

              {/* Ações de Moderação */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => verifyProviderByAdmin(provider.id, 'rejected')}
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-semibold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Recusar</span>
                </button>

                <button
                  type="button"
                  onClick={() => verifyProviderByAdmin(provider.id, 'verified')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Aprovar com Selo Verificado</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Distribuição por Bairros */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Bairros com Maior Atividade
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {CITY_CONFIG.defaultNeighborhoods.slice(0, 6).map((bairro, idx) => (
            <div
              key={bairro}
              className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between"
            >
              <span className="font-medium text-slate-700">{bairro}</span>
              <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                {`${12 - idx * 2} serviços`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
