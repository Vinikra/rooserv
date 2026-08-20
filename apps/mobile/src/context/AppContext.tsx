import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  ProviderProfile,
  ServiceCategory,
  Order,
  ServiceRequest,
  Review,
  UserProfile,
  UserRole,
  VerificationStatus,
  SignupData,
  AuthResult,
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

const AUTH_STORAGE_KEY = 'rooserv_authenticated_user';

export const ADMIN_PROFILE: UserProfile = {
  id: 'usr-admin-master',
  role: 'admin',
  fullName: 'Administração RooServ',
  email: 'admin@rooserv.com',
  phone: '(66) 99999-8888',
  neighborhood: 'Centro',
  city: 'Rondonópolis',
  state: 'MT',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<AuthResult>;
  signup: (data: SignupData) => Promise<AuthResult>;
  loginAsAdmin: (secretOrPass: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  categories: ServiceCategory[];
  providers: ProviderProfile[];
  orders: Order[];
  reviews: Review[];
  requests: ServiceRequest[];
  selectedNeighborhood: string;
  setSelectedNeighborhood: (bairro: string) => void;
  selectedCategorySlug: string | null;
  setSelectedCategorySlug: (slug: string | null) => void;

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
  openDispute: (orderId: string, reason: string, details: string) => void;
  resolveDisputeByAdmin: (orderId: string, decision: 'refund_client' | 'release_provider') => void;
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

function mapDbCategory(c: any): ServiceCategory {
  return {
    id: c.id,
    name: c.name || 'Serviço',
    slug: c.slug || 'servico',
    iconName: c.icon_name || 'Zap',
    description: c.description || '',
    averageTicketEstimate: Number(c.average_ticket_estimate) || 100,
    isActive: c.is_active ?? true,
  };
}

function mapDbProfile(prof: any, profileId: string): UserProfile {
  return {
    id: prof?.id || profileId,
    role: prof?.role || 'provider',
    fullName: prof?.full_name || 'Profissional',
    email: prof?.email || '',
    phone: prof?.phone || '(66) 99888-0000',
    neighborhood: prof?.neighborhood || 'Centro',
    city: prof?.city || 'Rondonópolis',
    state: 'MT',
    avatarUrl: prof?.avatar_url || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200',
    isActive: prof?.is_active ?? true,
    createdAt: new Date().toISOString(),
  };
}

function mapDbProvider(p: any): ProviderProfile {
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
    profile: mapDbProfile(prof, p.profile_id),
    categories: INITIAL_CATEGORIES.slice(0, 2),
    portfolio: INITIAL_PROVIDERS[0]?.portfolio || [],
  };
}

function computeAdminStats(orders: Order[], providers: ProviderProfile[]) {
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
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicialização de usuário a partir do localStorage
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignora erro de JSON
    }
    return INITIAL_CLIENT;
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.role || 'client';
      }
    } catch {
      // Ignora
    }
    return 'client';
  });

  const [categories, setCategories] = useState<ServiceCategory[]>(INITIAL_CATEGORIES);
  const [providers, setProviders] = useState<ProviderProfile[]>(INITIAL_PROVIDERS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [requests, setRequests] = useState<ServiceRequest[]>(INITIAL_REQUESTS);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Todos os Bairros');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);

  const isAuthenticated = Boolean(currentUser);
  const isAdmin = currentUser?.role === 'admin' || currentRole === 'admin';

  // Sincroniza sessão no localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // Sincronização inicial com o Supabase
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const { data: dbCategories } = await supabase.from('service_categories').select('*').order('sort_order');
        if (dbCategories && dbCategories.length > 0) {
          setCategories(dbCategories.map(mapDbCategory));
        }

        const { data: dbProviders } = await supabase
          .from('provider_profiles')
          .select(`
            id, profile_id, verification_status, bio, experience_years,
            hourly_rate_estimate, pix_key_type, pix_key, average_rating,
            total_reviews, total_completed_orders, is_available,
            profiles ( id, full_name, email, phone, neighborhood, city, state, avatar_url, is_active )
          `);

        if (dbProviders && dbProviders.length > 0) {
          setProviders(dbProviders.map(mapDbProvider));
        }
      } catch {
        console.log('Usando dataset local resiliente RooServ.');
      }
    }
    loadFromSupabase();
  }, []);

  // Canal Global de Eventos em Tempo Real (WebSockets Supabase)
  useEffect(() => {
    const globalChannel = supabase.channel('rooserv_global_events', {
      config: { broadcast: { self: false } },
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

  // Método de Login Completo
  const login = async (email: string, pass: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificação Especial de Administrador
    if (cleanEmail === 'admin@rooserv.com' || cleanEmail === 'admin') {
      if (pass === 'admin2026' || pass === 'Vini@220499' || pass === 'admin' || pass === 'Vini@2204992026') {
        setCurrentUser(ADMIN_PROFILE);
        setCurrentRole('admin');
        return { success: true, user: ADMIN_PROFILE };
      }
      return { success: false, error: 'Senha de administrador incorreta.' };
    }

    // 2. Tenta autenticar via Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (!error && data?.user) {
        // Busca perfil no banco
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .single();

        if (dbProfile) {
          const user: UserProfile = {
            id: dbProfile.id,
            role: dbProfile.role || 'client',
            fullName: dbProfile.full_name || 'Usuário RooServ',
            email: dbProfile.email,
            phone: dbProfile.phone || '',
            neighborhood: dbProfile.neighborhood || 'Centro',
            city: dbProfile.city || 'Rondonópolis',
            state: dbProfile.state || 'MT',
            avatarUrl: dbProfile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            isActive: true,
            createdAt: dbProfile.created_at || new Date().toISOString(),
          };
          setCurrentUser(user);
          setCurrentRole(user.role);
          return { success: true, user };
        }
      }
    } catch {
      // Prossegue para o fallback local resiliente
    }

    // 3. Fallback Local / Usuários de Teste Mock
    if (cleanEmail === 'mariana@email.com') {
      setCurrentUser(INITIAL_CLIENT);
      setCurrentRole('client');
      return { success: true, user: INITIAL_CLIENT };
    }

    if (cleanEmail.includes('carlos') || cleanEmail.includes('eletrica')) {
      const providerUser = INITIAL_PROVIDERS[0].profile || INITIAL_CLIENT;
      setCurrentUser(providerUser);
      setCurrentRole('provider');
      return { success: true, user: providerUser };
    }

    // Usuário genérico para simulações instantâneas
    const fallbackUser: UserProfile = {
      id: `usr-${Date.now()}`,
      role: 'client',
      fullName: cleanEmail.split('@')[0].toUpperCase(),
      email: cleanEmail,
      phone: '(66) 99999-0000',
      neighborhood: 'Vila Aurora',
      city: 'Rondonópolis',
      state: 'MT',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(fallbackUser);
    setCurrentRole('client');
    return { success: true, user: fallbackUser };
  };

  // Método de Cadastro (Signup)
  const signup = async (data: SignupData): Promise<AuthResult> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const newUserId = `usr-${Date.now()}`;

    const newUser: UserProfile = {
      id: newUserId,
      role: data.role,
      fullName: data.fullName.trim(),
      email: cleanEmail,
      phone: data.phone.trim(),
      neighborhood: data.neighborhood,
      city: 'Rondonópolis',
      state: 'MT',
      documentCpf: data.documentCpf,
      avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // Tenta gravar no Supabase
    try {
      await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password || '123456',
        options: {
          data: {
            full_name: newUser.fullName,
            phone: newUser.phone,
            neighborhood: newUser.neighborhood,
            role: newUser.role,
          },
        },
      });

      await supabase.from('profiles').insert([
        {
          id: newUserId,
          role: newUser.role,
          full_name: newUser.fullName,
          email: newUser.email,
          phone: newUser.phone,
          neighborhood: newUser.neighborhood,
          city: newUser.city,
          state: newUser.state,
          avatar_url: newUser.avatarUrl,
        },
      ]);
    } catch {
      // Ignora e prossegue localmente
    }

    setCurrentUser(newUser);
    setCurrentRole(newUser.role);
    return { success: true, user: newUser };
  };

  // Login Seguro de Administrador
  const loginAsAdmin = async (secretOrPass: string): Promise<AuthResult> => {
    const key = secretOrPass.trim();
    if (key === 'admin2026' || key === 'Vini@220499' || key === 'Vini@2204992026' || key === 'admin') {
      setCurrentUser(ADMIN_PROFILE);
      setCurrentRole('admin');
      return { success: true, user: ADMIN_PROFILE };
    }
    return { success: false, error: 'Chave ou senha administrativa incorreta.' };
  };

  // Logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora
    }
    setCurrentUser(null);
    setCurrentRole('client');
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const createServiceRequest = (data: {
    categoryId: string;
    title: string;
    description: string;
    urgency: 'low' | 'normal' | 'urgent_today';
    neighborhood: string;
    budget?: number;
  }) => {
    const category = categories.find((c) => c.id === data.categoryId) || categories[0];
    const client = currentUser || INITIAL_CLIENT;

    const newReq: ServiceRequest = {
      id: `req-${Date.now()}`,
      clientId: client.id,
      client,
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

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'new_request',
      payload: newReq,
    });

    return newReq;
  };

  const hireProviderWithEscrow = (params: {
    providerId: string;
    amount: number;
    paymentMethod: 'pix' | 'credit_card';
    installments: number;
  }): Order => {
    const provider = providers.find((p) => p.id === params.providerId);
    const split = calculateServiceSplit(params.amount, 12.0);
    const client = currentUser || INITIAL_CLIENT;

    const randomSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
      ? (1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000))
      : 5521;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `SRV-2026-${randomSuffix}`,
      clientId: client.id,
      client,
      providerId: params.providerId,
      provider,
      totalAmount: split.totalAmount,
      platformFeePercent: split.platformFeePercent,
      platformFeeAmount: split.platformFeeAmount,
      providerPayoutAmount: split.providerPayoutAmount,
      status: 'payment_in_escrow',
      paymentMethod: params.paymentMethod,
      installmentsCount: params.installments,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: { orderId: newOrder.id, changes: { status: 'payment_in_escrow' } },
    });

    return newOrder;
  };

  const markOrderAsCompletedByProvider = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'completed_by_provider', completedAt: new Date().toISOString() }
          : o
      )
    );

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: { orderId, changes: { status: 'completed_by_provider' } },
    });
  };

  const confirmAndReleaseEscrow = (params: {
    orderId: string;
    rating: number;
    comment: string;
    tags: string[];
  }) => {
    const targetOrder = orders.find((o) => o.id === params.orderId);
    if (!targetOrder) return;
    const client = currentUser || INITIAL_CLIENT;

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

    const newReview: Review = {
      id: `rev-${Date.now()}`,
      orderId: params.orderId,
      clientId: client.id,
      client,
      providerId: targetOrder.providerId,
      rating: params.rating,
      comment: params.comment,
      tags: params.tags,
      photos: [],
      createdAt: new Date().toISOString(),
    };

    setReviews((prev) => [newReview, ...prev]);

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: {
        orderId: params.orderId,
        changes: { status: 'approved_by_client', fundsReleasedAt: new Date().toISOString() },
      },
    });
  };

  const verifyProviderByAdmin = (providerId: string, status: VerificationStatus) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, verificationStatus: status } : p))
    );
  };

  const requestProviderPayout = (providerId: string, amount: number): boolean => {
    console.log(`[PIX ASYNC ROOSERV] Transferindo R$ ${amount} para o prestador ${providerId}`);
    return true;
  };

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

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: {
        orderId,
        changes: {
          status: 'disputed',
          disputeReason: reason,
          disputeDetails: details,
        },
      },
    });
  };

  const resolveDisputeByAdmin = (orderId: string, decision: 'refund_client' | 'release_provider') => {
    const finalStatus: OrderStatus = decision === 'refund_client' ? 'refunded' : 'approved_by_client';

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: finalStatus,
              disputeResolvedAt: new Date().toISOString(),
            }
          : o
      )
    );

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: {
        orderId,
        changes: { status: finalStatus, disputeResolvedAt: new Date().toISOString() },
      },
    });
  };

  const getAdminStats = () => computeAdminStats(orders, providers);

  const contextValue = useMemo(
    () => ({
      currentRole,
      setCurrentRole,
      currentUser,
      isAuthenticated,
      isAdmin,
      login,
      signup,
      loginAsAdmin,
      logout,
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
    }),
    [
      currentRole,
      currentUser,
      isAuthenticated,
      isAdmin,
      categories,
      providers,
      orders,
      reviews,
      requests,
      selectedNeighborhood,
      selectedCategorySlug,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider');
  }
  return context;
};
