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
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrencyBRL, CITY_CONFIG } from '@servicos/shared';

export const AdminScreen: React.FC = () => {
  const { 
    adminProviders,
    orders, 
    verifyProviderByAdmin, 
    resolveDisputeByAdmin, 
    getAdminStats,
    isAdmin,
    setCurrentRole
  } = useApp();

  const [pendingDisputeId, setPendingDisputeId] = useState<string | null>(null);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const [loadingDocumentsId, setLoadingDocumentsId] = useState<string | null>(null);
  const [kycDocuments, setKycDocuments] = useState<Record<string, {
    idFront: string;
    idBack: string;
    selfie: string;
  }>>({});
  const [operationError, setOperationError] = useState<string | null>(null);

  const handleResolveDispute = async (
    orderId: string,
    decision: 'refund_client' | 'release_provider'
  ) => {
    setPendingDisputeId(orderId);
    setOperationError(null);
    try {
      await resolveDisputeByAdmin(orderId, decision);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Não foi possível resolver a disputa.');
    } finally {
      setPendingDisputeId(null);
    }
  };

  const handleReviewProvider = async (
    providerId: string,
    decision: 'verified' | 'rejected'
  ) => {
    setPendingProviderId(providerId);
    setOperationError(null);
    try {
      await verifyProviderByAdmin(providerId, decision);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Não foi possível revisar o prestador.');
    } finally {
      setPendingProviderId(null);
    }
  };

  const handleLoadKycDocuments = async (providerId: string) => {
    setLoadingDocumentsId(providerId);
    setOperationError(null);
    try {
      const { data, error } = await supabase.functions.invoke('get-kyc-review', {
        body: { providerId },
      });
      if (error || !data?.documents) {
        throw new Error(error?.message || 'Os documentos não foram retornados.');
      }
      setKycDocuments((current) => ({ ...current, [providerId]: data.documents }));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Não foi possível carregar os documentos.');
    } finally {
      setLoadingDocumentsId(null);
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
              Entre pela conta principal autorizada para acessar esta área.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCurrentRole('client')}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-3.5 rounded-xl"
            >
              Voltar para o aplicativo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stats = getAdminStats();

  const pendingProviders = adminProviders.filter(
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
      {operationError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-4 py-3 text-sm font-semibold">
          {operationError}
        </div>
      )}

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

                {order.disputeResolution === 'refund_client' ? (
                  <div className="bg-amber-100 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 text-xs font-bold">
                    Reembolso autorizado — aguardando processamento pelo Asaas.
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleResolveDispute(order.id, 'refund_client')}
                    disabled={pendingDisputeId === order.id}
                    className="bg-white hover:bg-slate-50 disabled:opacity-60 text-red-600 border border-red-300 font-bold text-xs py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reembolsar Cliente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveDispute(order.id, 'release_provider')}
                    disabled={pendingDisputeId === order.id}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Liberar Prestador</span>
                  </button>
                </div>
                )}
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

                {kycDocuments[prov.id] ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {([
                      ['Frente', kycDocuments[prov.id].idFront],
                      ['Verso', kycDocuments[prov.id].idBack],
                      ['Selfie', kycDocuments[prov.id].selfie],
                    ] as const).map(([label, url]) => (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLoadKycDocuments(prov.id)}
                    disabled={loadingDocumentsId === prov.id}
                    className="w-full bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-700 border border-slate-300 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{loadingDocumentsId === prov.id ? 'Carregando...' : 'Ver documentos'}</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleReviewProvider(prov.id, 'rejected')}
                    disabled={pendingProviderId === prov.id}
                    className="bg-white hover:bg-slate-100 disabled:opacity-60 text-red-600 border border-slate-300 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Recusar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewProvider(prov.id, 'verified')}
                    disabled={pendingProviderId === prov.id}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
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
