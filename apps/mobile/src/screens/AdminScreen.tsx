import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Clock, 
  RotateCcw, 
  Scale 
} from 'lucide-react';
import { formatCurrencyBRL, CITY_CONFIG } from '@servicos/shared';

export const AdminScreen: React.FC = () => {
  const { providers, orders, verifyProviderByAdmin, resolveDisputeByAdmin, getAdminStats } = useApp();
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
            {CITY_CONFIG.name} ({CITY_CONFIG.estimatedPopulation.toLocaleString('pt-BR')} hab)
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
          <span className="text-[10px] text-slate-400 block">Movimentado na cidade</span>
        </div>

        {/* Dinheiro Seguro em Custódia */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Retido em Custódia</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg font-extrabold text-blue-600">
            {formatCurrencyBRL(stats.inEscrowAmount)}
          </h3>
          <span className="text-[10px] text-slate-400 block">Serviços sendo executados</span>
        </div>
      </div>

      {/* Mesa de Mediação e Disputas (Arbitragem do Dono do App) */}
      {disputedOrders.length > 0 && (
        <div className="bg-red-50/70 rounded-2xl p-4 border border-red-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="text-xs font-bold text-red-950 uppercase tracking-wider">
                  Mesa de Mediação & Disputas ({disputedOrders.length})
                </h3>
                <p className="text-[11px] text-red-800">
                  Valores em custódia aguardando sua decisão de arbitragem
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {disputedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-3.5 border border-red-200 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      Disputa Aberta • Pedido {order.orderNumber}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1">
                      Valor Retido: {formatCurrencyBRL(order.totalAmount)}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Cliente: {order.client?.fullName || 'Mariana'}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border text-xs space-y-1">
                  <p className="text-red-950 font-semibold">
                    Motivo: <span>{order.disputeReason}</span>
                  </p>
                  {order.disputeDetails && (
                    <p className="text-slate-600 italic">
                      "{order.disputeDetails}"
                    </p>
                  )}
                </div>

                {/* Ações de Arbitragem */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => resolveDisputeByAdmin(order.id, 'refund_client')}
                    className="bg-white hover:bg-slate-50 text-red-600 border border-red-300 font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reembolsar Morador</span>
                  </button>

                  <button
                    onClick={() => resolveDisputeByAdmin(order.id, 'release_provider')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Liberar p/ Prestador</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fila de Verificação de Documentos (KYC) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Fila de Verificação de Documentos ({pendingProviders.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Apenas prestadores aprovados aparecem nas buscas dos moradores.
            </p>
          </div>
        </div>

        {pendingProviders.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-4 text-center text-xs text-slate-500">
            ✓ Nenhum prestador aguardando aprovação no momento.
          </div>
        ) : (
          pendingProviders.map((provider) => (
            <div
              key={provider.id}
              className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={provider.profile?.avatarUrl}
                    alt={provider.profile?.fullName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {provider.profile?.fullName}
                    </h4>
                    <span className="text-[11px] text-slate-500 block">
                      {provider.profile?.neighborhood} • {provider.categories[0]?.name}
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
                  onClick={() => verifyProviderByAdmin(provider.id, 'rejected')}
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-semibold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Recusar</span>
                </button>

                <button
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
                {12 - idx * 2} serviços
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
