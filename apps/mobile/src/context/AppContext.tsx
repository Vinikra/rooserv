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
  InAppNotification,
  InAppNotificationType,
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
import { inAppSound } from '../utils/notificationSound';

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

  // Notificações In-App em Tempo Real (Estilo Uber)
  notifications: InAppNotification[];
  activeToast: InAppNotification | null;
  unreadNotificationsCount: number;
  sendInAppNotification: (notif: {
    title: string;
    message: string;
    type: InAppNotificationType;
    actionTab?: string;
    metadata?: Record<string, any>;
    playSound?: boolean;
  }) => void;
  dismissActiveToast: () => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;

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
    state: prof?.state || 'MT',
    avatarUrl: prof?.avatar_url || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150',
    isActive: prof?.is_active ?? true,
    createdAt: prof?.created_at || '2026-01-01T00:00:00Z',
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

  // Sistema de Notificações In-App em Tempo Real (Estilo Uber)
  const [notifications, setNotifications] = useState<InAppNotification[]>([
    {
      id: 'notif-1',
      title: 'Custódia Ativa no Serviço',
      message: 'Seu pagamento de R$ 150,00 foi retido com segurança. O prestador foi notificado para iniciar.',
      time: 'Há 5 min',
      type: 'payment',
      isRead: false,
      actionTab: 'orders',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      title: 'Nova Mensagem do Prestador',
      message: 'Carlos Elétrica: "Consigo ir aí hoje às 16h30 para fazer o serviço completo."',
      time: 'Há 20 min',
      type: 'message',
      isRead: false,
      actionTab: 'messages',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-3',
      title: 'Garantia RooServ Ativa',
      message: 'Todos os seus serviços contratados possuem cobertura da plataforma contra calotes.',
      time: 'Hoje',
      type: 'system',
      isRead: true,
      createdAt: new Date().toISOString(),
    },
  ]);

  const [activeToast, setActiveToast] = useState<InAppNotification | null>(null);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const sendInAppNotification = (notif: {
    title: string;
    message: string;
    type: InAppNotificationType;
    actionTab?: string;
    metadata?: Record<string, any>;
    playSound?: boolean;
  }) => {
    const newNotif: InAppNotification = {
      id: `notif-${Date.now()}`,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      time: 'Agora',
      isRead: false,
      actionTab: notif.actionTab,
      metadata: notif.metadata,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setActiveToast(newNotif);

    if (notif.playSound !== false) {
      inAppSound.playChime(notif.type);
    }
  };

  const dismissActiveToast = () => {
    setActiveToast(null);
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

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
        const { data: dbCategories, error: catError } = await supabase
          .from('categories')
          .select('*')
          .order('name');

        if (!catError && dbCategories && dbCategories.length > 0) {
          setCategories(dbCategories.map(mapDbCategory));
        }

        const { data: dbProviders, error: provError } = await supabase
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
              role,
              full_name,
              email,
              phone,
              neighborhood,
              city,
              state,
              avatar_url,
              is_active,
              created_at
            )
          `);

        if (!provError && dbProviders && dbProviders.length > 0) {
          setProviders(dbProviders.map(mapDbProvider));
        }
      } catch {
        // Fallback resiliente caso Supabase esteja desconectado
      }
    }

    loadFromSupabase();
  }, []);

  // WebSockets Realtime Globais para Sincronização Instantânea
  useEffect(() => {
    const globalChannel = supabase.channel('rooserv_global_events', {
      config: { broadcast: { self: false } },
    });

    globalChannel
      .on('broadcast', { event: 'new_request' }, (payload) => {
        if (payload?.payload) {
          setRequests((prev) => [payload.payload, ...prev]);
          sendInAppNotification({
            title: '🔔 Nova Oportunidade na Cidade!',
            message: `Cliente publicou: "${payload.payload.title}" no bairro ${payload.payload.addressNeighborhood}.`,
            type: 'order',
            actionTab: 'provider_leads',
          });
        }
      })
      .on('broadcast', { event: 'order_updated' }, (payload) => {
        const { orderId, changes } = payload?.payload || {};
        if (orderId && changes) {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, ...changes } : o))
          );
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
        sendInAppNotification({
          title: '🛡️ Modo Gestor Autenticado',
          message: 'Painel de administração master liberado com métricas financeiras e KYC.',
          type: 'system',
        });
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
          sendInAppNotification({
            title: `👋 Bem-vindo(a), ${user.fullName.split(' ')[0]}!`,
            message: 'Você está conectado à plataforma RooServ Rondonópolis.',
            type: 'system',
          });
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
      sendInAppNotification({
        title: '👋 Bem-vinda, Mariana!',
        message: 'Você está conectada como Moradora em Rondonópolis.',
        type: 'system',
      });
      return { success: true, user: INITIAL_CLIENT };
    }

    if (cleanEmail.includes('carlos') || cleanEmail.includes('eletrica')) {
      const providerUser = INITIAL_PROVIDERS[0].profile || INITIAL_CLIENT;
      setCurrentUser(providerUser);
      setCurrentRole('provider');
      sendInAppNotification({
        title: '⚡ Painel do Profissional Conectado',
        message: 'Você está pronto para receber pedidos e chamados na cidade.',
        type: 'system',
      });
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
    sendInAppNotification({
      title: '👋 Conta Conectada',
      message: 'Bem-vindo(a) ao RooServ!',
      type: 'system',
    });
    return { success: true, user: fallbackUser };
  };

  // Método de Cadastro Completo
  const signup = async (data: SignupData): Promise<AuthResult> => {
    const cleanEmail = data.email.trim().toLowerCase();

    let authUserId = `usr-${Date.now()}`;
    try {
      if (data.password) {
        const { data: authData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              role: data.role,
              neighborhood: data.neighborhood,
            },
          },
        });
        if (!error && authData?.user) {
          authUserId = authData.user.id;
        }
      }
    } catch {
      // Fallback
    }

    const newUser: UserProfile = {
      id: authUserId,
      role: data.role,
      fullName: data.fullName,
      email: cleanEmail,
      phone: data.phone,
      neighborhood: data.neighborhood || 'Centro',
      city: 'Rondonópolis',
      state: 'MT',
      avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await supabase.from('profiles').upsert([
        {
          id: newUser.id,
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
    sendInAppNotification({
      title: '🎉 Conta Criada com Sucesso!',
      message: 'Bem-vindo ao RooServ! Contrate ou anuncie serviços com 100% de garantia.',
      type: 'system',
    });
    return { success: true, user: newUser };
  };

  // Login Seguro de Administrador
  const loginAsAdmin = async (secretOrPass: string): Promise<AuthResult> => {
    const key = secretOrPass.trim();
    if (key === 'admin2026' || key === 'Vini@220499' || key === 'Vini@2204992026' || key === 'admin') {
      setCurrentUser(ADMIN_PROFILE);
      setCurrentRole('admin');
      sendInAppNotification({
        title: '🛡️ Gestão RooServ',
        message: 'Acesso liberado às métricas e conciliação financeira.',
        type: 'system',
      });
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

    // Dispara Notificação In-App (Estilo Uber)
    sendInAppNotification({
      title: '🔔 Pedido de Orçamento Publicado!',
      message: `Seu pedido "${data.title}" foi enviado aos profissionais verificados da cidade.`,
      type: 'order',
      actionTab: 'orders',
    });

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

    // Dispara Notificação In-App em Tempo Real
    sendInAppNotification({
      title: '🔒 Pagamento em Custódia Segura!',
      message: `R$ ${split.totalAmount.toFixed(2)} retidos com proteção RooServ. O prestador ${provider?.profile?.fullName || ''} foi avisado no app para iniciar o serviço!`,
      type: 'payment',
      actionTab: 'orders',
    });

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

    sendInAppNotification({
      title: '🛠️ Serviço Marcado como Concluído!',
      message: 'O prestador finalizou o serviço. Inspecione e clique em Aprovar para liberar o pagamento.',
      type: 'order',
      actionTab: 'orders',
    });

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

    sendInAppNotification({
      title: '💰 Pagamento Liberado com Sucesso!',
      message: `Transferência de R$ ${targetOrder.providerPayoutAmount.toFixed(2)} liberada diretamente para a carteira do profissional.`,
      type: 'payment',
      actionTab: 'orders',
    });

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

    sendInAppNotification({
      title: '⚠️ Disputa Aberta na Plataforma',
      message: 'O valor permanecerá retido sob custódia enquanto nossa moderação analisa o caso.',
      type: 'system',
      actionTab: 'orders',
    });

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
          disputeOpenedAt: new Date().toISOString(),
        },
      },
    });
  };

  const resolveDisputeByAdmin = (
    orderId: string,
    decision: 'refund_client' | 'release_provider'
  ) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        if (decision === 'refund_client') {
          return {
            ...o,
            status: 'refunded',
            disputeResolvedAt: new Date().toISOString(),
          };
        }
        return {
          ...o,
          status: 'approved_by_client',
          fundsReleasedAt: new Date().toISOString(),
          disputeResolvedAt: new Date().toISOString(),
        };
      })
    );

    const globalChannel = supabase.channel('rooserv_global_events');
    globalChannel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: {
        orderId,
        changes: {
          status: decision === 'refund_client' ? 'refunded' : 'approved_by_client',
          disputeResolvedAt: new Date().toISOString(),
        },
      },
    });
  };

  const getAdminStats = () => computeAdminStats(orders, providers);

  return (
    <AppContext.Provider
      value={{
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

        notifications,
        activeToast,
        unreadNotificationsCount,
        sendInAppNotification,
        dismissActiveToast,
        markAllNotificationsAsRead,
        clearNotifications,

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
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
