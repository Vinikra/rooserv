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
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header do Painel */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Painel do Dono da Plataforma</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
            {`${CITY_CONFIG.name} (${CITY_CONFIG.estimatedPopulation.toLocaleString('pt-BR')} hab)`}
          </h2>
        </div>

        <span className="bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-full border border-emerald-300">
          Taxa Fixa: 12%
        </span>
      </div>

      {/* Grid de Métricas Financeiras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Receita da Plataforma (12%) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 font-bold">
            <span>Sua Receita Líquida</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-emerald-600">
            {formatCurrencyBRL(stats.platformRevenue)}
          </h3>
          <span className="text-xs text-slate-400 block font-medium">Comissões de 12% retidas</span>
        </div>

        {/* Volume Total Transacionado (GMV) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 font-bold">
            <span>Volume Total (GMV)</span>
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            {formatCurrencyBRL(stats.totalVolumeTransacted)}
          </h3>
          <span className="text-xs text-slate-400 block font-medium">Serviços contratados</span>
        </div>

        {/* Dinheiro Retido em Custódia Segura */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 font-bold">
            <span>Em Custódia Segura</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-amber-600">
            {formatCurrencyBRL(stats.inEscrowAmount)}
          </h3>
          <span className="text-xs text-slate-400 block font-medium">Aguardando aprovação do morador</span>
        </div>
      </div>

      {/* Grid de Operações: Disputas & KYC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disputas & Mediações em Aberto */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-brand-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Arbitragem de Disputas ({disputedOrders.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Poder de decisão final</span>
          </div>

          {disputedOrders.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs sm:text-sm text-slate-500 flex flex-col items-center gap-1.5 font-medium">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
              <span>Nenhuma disputa aberta no momento.</span>
            </div>
          ) : (
            disputedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-red-50/60 rounded-2xl p-4 border border-red-200/80 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-red-700 block">
                      {order.orderNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {`Cliente: ${order.client?.fullName} vs Prestador: ${order.provider?.profile?.fullName}`}
                    </h4>
                  </div>
                  <strong className="text-sm font-black text-slate-900">{formatCurrencyBRL(order.totalAmount)}</strong>
                </div>

                <p className="text-xs text-red-950 font-medium">
                  <strong>Motivo:</strong> "{order.disputeReason}"
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => resolveDisputeByAdmin(order.id, 'refund_client')}
                    className="bg-white hover:bg-slate-50 text-red-600 border border-red-300 font-bold text-xs py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reembolsar Cliente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => resolveDisputeByAdmin(order.id, 'release_provider')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Liberar Prestador</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Fila de Verificação de Prestadores (KYC) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Fila de Verificação KYC ({pendingProviders.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Validação de identidade</span>
          </div>

          {pendingProviders.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs sm:text-sm text-slate-500 flex flex-col items-center gap-1.5 font-medium">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <span>Todos os prestadores cadastrados estão verificados!</span>
            </div>
          ) : (
            pendingProviders.map((prov) => (
              <div
                key={prov.id}
                className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={prov.profile?.avatarUrl}
                      alt={prov.profile?.fullName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                    />
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        {prov.profile?.fullName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {prov.profile?.neighborhood} • {prov.experienceYears} anos exp.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                    Pendente
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => verifyProviderByAdmin(prov.id, 'rejected')}
                    className="bg-white hover:bg-slate-100 text-red-600 border border-slate-300 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Recusar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => verifyProviderByAdmin(prov.id, 'verified')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Aprovar Selo</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
