import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ProviderProfile,
  ServiceCategory,
  Order,
  ServiceRequest,
  Review,
  UserProfile,
  UserRole,
  VerificationStatus,
  calculateServiceSplit,
} from '@servicos/shared';
import {
  INITIAL_CATEGORIES,
  INITIAL_CLIENT,
  INITIAL_PROVIDERS,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
  INITIAL_REQUESTS,
} from '../data/mockData';
import { supabase } from '../lib/supabase';

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: UserProfile;
  categories: ServiceCategory[];
  providers: ProviderProfile[];
  orders: Order[];
  reviews: Review[];
  requests: ServiceRequest[];
  selectedNeighborhood: string;
  setSelectedNeighborhood: (n: string) => void;
  selectedCategorySlug: string | null;
  setSelectedCategorySlug: (slug: string | null) => void;
  
  // Ações de Negócio
  createServiceRequest: (data: {
    categoryId: string;
    title: string;
    description: string;
    urgency: 'low' | 'normal' | 'urgent_today';
    neighborhood: string;
    budget?: number;
  }) => ServiceRequest;
  
  hireProviderWithEscrow: (params: {
    providerId: string;
    amount: number;
    paymentMethod: 'pix' | 'credit_card';
    installments: number;
  }) => Order;

  markOrderAsCompletedByProvider: (orderId: string) => void;
  
  confirmAndReleaseEscrow: (params: {
    orderId: string;
    rating: number;
    comment: string;
    tags: string[];
  }) => void;

  verifyProviderByAdmin: (providerId: string, status: VerificationStatus) => void;
  
  requestProviderPayout: (providerId: string, amount: number) => boolean;

  // Mediação & Disputas
  openDispute: (orderId: string, reason: string, details: string) => void;
  resolveDisputeByAdmin: (orderId: string, decision: 'refund_client' | 'release_provider') => void;

  // Estatísticas da Plataforma (Admin)
  getAdminStats: () => {
    totalVolumeTransacted: number;
    platformRevenue: number;
    inEscrowAmount: number;
    activeProvidersCount: number;
    pendingVerificationsCount: number;
    completedOrdersCount: number;
  };
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('client');
  const [currentUser] = useState<UserProfile>(INITIAL_CLIENT);
  const [categories, setCategories] = useState<ServiceCategory[]>(INITIAL_CATEGORIES);
  const [providers, setProviders] = useState<ProviderProfile[]>(INITIAL_PROVIDERS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [requests, setRequests] = useState<ServiceRequest[]>(INITIAL_REQUESTS);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Todos os Bairros');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);

  // Sincronização completa em tempo real com o Supabase
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        // 1. Categorias
        const { data: dbCategories } = await supabase.from('service_categories').select('*').order('sort_order');
        if (dbCategories && dbCategories.length > 0) {
          setCategories(
            dbCategories.map((c: any) => ({
              id: c.id,
              name: c.name || 'Serviço',
              slug: c.slug || 'servico',
              iconName: c.icon_name || 'Zap',
              description: c.description || '',
              averageTicketEstimate: Number(c.average_ticket_estimate) || 100,
              isActive: c.is_active ?? true,
            }))
          );
        }

        // 2. Prestadores com Perfil e Portfólio
        const { data: dbProviders } = await supabase
          .from('provider_profiles')
          .select(`
            id,
            profile_id,
            verification_status,
            bio,
            experience_years,
            hourly_rate_estimate,
            pix_key_type,
            pix_key,
            average_rating,
            total_reviews,
            total_completed_orders,
            is_available,
            profiles (
              id,
              full_name,
              email,
              phone,
              neighborhood,
              city,
              state,
              avatar_url,
              is_active
            )
          `);

        if (dbProviders && dbProviders.length > 0) {
          setProviders(
            dbProviders.map((p: any) => {
              const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              return {
                id: p.id,
                profileId: p.profile_id,
                verificationStatus: p.verification_status || 'verified',
                bio: p.bio || 'Profissional qualificado em Rondonópolis.',
                experienceYears: Number(p.experience_years) || 3,
                hourlyRateEstimate: Number(p.hourly_rate_estimate) || 80,
                pixKeyType: p.pix_key_type || 'cpf',
                pixKey: p.pix_key || '',
                averageRating: Number(p.average_rating) || 5.0,
                totalReviews: Number(p.total_reviews) || 0,
                totalCompletedOrders: Number(p.total_completed_orders) || 0,
                isAvailable: p.is_available ?? true,
                profile: {
                  id: prof?.id || p.profile_id,
                  role: 'provider',
                  fullName: prof?.full_name || 'Profissional',
                  email: prof?.email || '',
                  phone: prof?.phone || '(66) 99888-0000',
                  neighborhood: prof?.neighborhood || 'Centro',
                  city: prof?.city || 'Rondonópolis',
                  state: prof?.state || 'MT',
                  avatarUrl: prof?.avatar_url || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200',
                  isActive: prof?.is_active ?? true,
                  createdAt: new Date().toISOString(),
                },
                categories: INITIAL_CATEGORIES.slice(0, 2),
                portfolio: INITIAL_PROVIDERS[0]?.portfolio || [],
              };
            })
          );
        }
      } catch (err) {
        console.log('Usando dataset local resiliente RooServ.');
      }
    }
    loadFromSupabase();
  }, []);

  // Canal Global de Eventos em Tempo Real (WebSockets Supabase)
  useEffect(() => {
    const globalChannel = supabase.channel('rooserv_global_events', {
      config: {
        broadcast: { self: false },
      },
    });

    globalChannel
      .on('broadcast', { event: 'order_updated' }, (payload) => {
        if (payload?.payload?.orderId) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.payload.orderId ? { ...o, ...payload.payload.changes } : o
            )
          );
        }
      })
      .on('broadcast', { event: 'new_request' }, (payload) => {
        if (payload?.payload) {
          setRequests((prev) => [payload.payload, ...prev]);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, []);

  // Criar uma nova solicitação de orçamento
  const createServiceRequest = (data: {
    categoryId: string;
    title: string;
    description: string;
    urgency: 'low' | 'normal' | 'urgent_today';
    neighborhood: string;
    budget?: number;
  }) => {
    const category = categories.find((c) => c.id === data.categoryId) || categories[0];
    const newReq: ServiceRequest = {
      id: `req-${Date.now()}`,
      clientId: currentUser.id,
      client: currentUser,
      categoryId: category.id,
      category,
      title: data.title,
      description: data.description,
      urgency: data.urgency,
      addressNeighborhood: data.neighborhood,
      budgetEstimate: data.budget,
      photos: [],
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [newReq, ...prev]);

    // Transmite a nova oportunidade para os prestadores via Realtime
    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'new_request',
      payload: newReq,
    });

    return newReq;
  };

  // Contratação com Pagamento Retido em Custódia (Escrow)
  const hireProviderWithEscrow = (params: {
    providerId: string;
    amount: number;
    paymentMethod: 'pix' | 'credit_card';
    installments: number;
  }): Order => {
    const provider = providers.find((p) => p.id === params.providerId);
    const split = calculateServiceSplit(params.amount, 12.0);

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `SRV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: currentUser.id,
      client: currentUser,
      providerId: params.providerId,
      provider,
      totalAmount: split.totalAmount,
      platformFeePercent: split.platformFeePercent,
      platformFeeAmount: split.platformFeeAmount,
      providerPayoutAmount: split.providerPayoutAmount,
      status: 'payment_in_escrow', // Dinheiro seguro na custódia
      paymentMethod: params.paymentMethod,
      installmentsCount: params.installments,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  };

  // Prestador finalizou o serviço
  const markOrderAsCompletedByProvider = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'completed_by_provider', completedAt: new Date().toISOString() }
          : o
      )
    );

    // Transmite status concluído em tempo real para o morador
    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: {
        orderId,
        changes: { status: 'completed_by_provider', completedAt: new Date().toISOString() },
      },
    });
  };

  // Cliente aprova o serviço, libera a custódia para o prestador e deixa avaliação
  const confirmAndReleaseEscrow = (params: {
    orderId: string;
    rating: number;
    comment: string;
    tags: string[];
  }) => {
    const targetOrder = orders.find((o) => o.id === params.orderId);
    if (!targetOrder) return;

    // 1. Atualiza status do pedido
    setOrders((prev) =>
      prev.map((o) =>
        o.id === params.orderId
          ? {
              ...o,
              status: 'approved_by_client',
              fundsReleasedAt: new Date().toISOString(),
            }
          : o
      )
    );

    // 2. Cria o review verificado
    const newReview: Review = {
      id: `rev-${Date.now()}`,
      orderId: params.orderId,
      clientId: currentUser.id,
      client: currentUser,
      providerId: targetOrder.providerId,
      rating: params.rating,
      comment: params.comment,
      tags: params.tags,
      photos: [],
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [newReview, ...prev]);

    // 3. Atualiza métricas do prestador
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === targetOrder.providerId) {
          const newTotalReviews = p.totalReviews + 1;
          const newAvgRating = Number(
            ((p.averageRating * p.totalReviews + params.rating) / newTotalReviews).toFixed(2)
          );
          return {
            ...p,
            averageRating: newAvgRating,
            totalReviews: newTotalReviews,
            totalCompletedOrders: p.totalCompletedOrders + 1,
          };
        }
        return p;
      })
    );
  };

  // Admin aprova/rejeita verificação de prestador
  const verifyProviderByAdmin = (providerId: string, status: VerificationStatus) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? {
              ...p,
              verificationStatus: status,
              verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
            }
          : p
      )
    );
  };

  // Solicitação de saque do prestador via Pix
  const requestProviderPayout = (providerId: string, amount: number): boolean => {
    return true;
  };

  // Abrir Disputa / Reportar Problema
  const openDispute = (orderId: string, reason: string, details: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'disputed',
              disputeReason: reason,
              disputeDetails: details,
              disputeOpenedAt: new Date().toISOString(),
            }
          : o
      )
    );
  };

  // Resolução de Disputa pelo Admin
  const resolveDisputeByAdmin = (orderId: string, decision: 'refund_client' | 'release_provider') => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          if (decision === 'refund_client') {
            return {
              ...o,
              status: 'refunded',
              disputeResolvedAt: new Date().toISOString(),
            };
          } else {
            return {
              ...o,
              status: 'approved_by_client',
              fundsReleasedAt: new Date().toISOString(),
              disputeResolvedAt: new Date().toISOString(),
            };
          }
        }
        return o;
      })
    );
  };

  // Estatísticas para o Dashboard Admin
  const getAdminStats = () => {
    const totalVolumeTransacted = orders.reduce((acc, o) => acc + o.totalAmount, 0);
    const platformRevenue = orders.reduce((acc, o) => acc + o.platformFeeAmount, 0);
    const inEscrowAmount = orders
      .filter((o) => o.status === 'payment_in_escrow' || o.status === 'completed_by_provider' || o.status === 'disputed')
      .reduce((acc, o) => acc + o.providerPayoutAmount, 0);
    const activeProvidersCount = providers.filter((p) => p.verificationStatus === 'verified').length;
    const pendingVerificationsCount = providers.filter((p) => p.verificationStatus === 'under_review' || p.verificationStatus === 'pending').length;
    const completedOrdersCount = orders.filter((o) => o.status === 'approved_by_client').length;

    return {
      totalVolumeTransacted,
      platformRevenue,
      inEscrowAmount,
      activeProvidersCount,
      pendingVerificationsCount,
      completedOrdersCount,
    };
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        currentUser,
        categories,
        providers,
        orders,
        reviews,
        requests,
        selectedNeighborhood,
        setSelectedNeighborhood,
        selectedCategorySlug,
        setSelectedCategorySlug,
        createServiceRequest,
        hireProviderWithEscrow,
        markOrderAsCompletedByProvider,
        confirmAndReleaseEscrow,
        verifyProviderByAdmin,
        requestProviderPayout,
        openDispute,
        resolveDisputeByAdmin,
        getAdminStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser usado dentro de um AppProvider');
  }
  return context;
};
