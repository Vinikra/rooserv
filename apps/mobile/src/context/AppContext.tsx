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

  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateProviderProfile: (data: {
    bio?: string;
    hourlyRateEstimate?: number;
    experienceYears?: number;
    pixKey?: string;
    pixKeyType?: string;
    categories?: ServiceCategory[];
  }) => Promise<void>;

  createServiceRequest: (data: {
    categoryId: string;
    title: string;
    description: string;
    urgency: 'low' | 'normal' | 'urgent_today';
    neighborhood: string;
    budget?: number;
    photos?: string[];
  }) => Promise<ServiceRequest>;

  hireProviderWithEscrow: (params: {
    providerId: string;
    amount: number;
    paymentMethod: 'pix' | 'credit_card';
    installments: number;
  }) => Promise<Order>;

  markOrderAsCompletedByProvider: (orderId: string, proofPhotos?: string[]) => Promise<void>;

  confirmAndReleaseEscrow: (params: {
    orderId: string;
    rating: number;
    comment: string;
    tags: string[];
  }) => Promise<void>;

  verifyProviderByAdmin: (providerId: string, status: VerificationStatus) => void;
  requestProviderPayout: (providerId: string, amount: number) => boolean;
  openDispute: (orderId: string, reason: string, details: string) => Promise<void>;
  resolveDisputeByAdmin: (orderId: string, decision: 'refund_client' | 'release_provider') => Promise<void>;
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
    return null;
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
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

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

    // Dispara Notificação Nativa do Navegador / Sistema Operacional se permitido
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notif.title, {
          body: notif.message,
          icon: '/icon-192.png',
        });
      } catch {
        // Fallback silencioso
      }
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
          .from('service_categories')
          .select('*')
          .order('sort_order', { ascending: true });

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

        // Carrega pedidos do Supabase
        const userId = currentUser?.id;
        if (userId) {
          const { data: dbOrders } = await supabase
            .from('orders')
            .select('*')
            .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(100);

          if (dbOrders && dbOrders.length > 0) {
            const mappedOrders: Order[] = dbOrders.map((o: any) => ({
              id: o.id,
              orderNumber: o.order_number || `SRV-${o.id.slice(0, 8)}`,
              clientId: o.client_id,
              providerId: o.provider_id,
              proposalId: o.proposal_id,
              requestId: o.request_id,
              totalAmount: Number(o.total_amount) || 0,
              platformFeePercent: Number(o.platform_fee_percent) || 12,
              platformFeeAmount: Number(o.platform_fee_amount) || 0,
              providerPayoutAmount: Number(o.provider_payout_amount) || 0,
              status: o.status || 'payment_in_escrow',
              paymentMethod: o.payment_method,
              installmentsCount: o.installments_count || 1,
              paidAt: o.paid_at,
              completedAt: o.completed_at,
              fundsReleasedAt: o.funds_released_at,
              createdAt: o.created_at,
            }));
            setOrders((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newOrders = mappedOrders.filter((o) => !existingIds.has(o.id));
              return newOrders.length > 0 ? [...newOrders, ...prev] : prev;
            });
          }

          // Carrega reviews do Supabase
          const { data: dbReviews } = await supabase
            .from('reviews')
            .select('*')
            .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(100);

          if (dbReviews && dbReviews.length > 0) {
            const mappedReviews: Review[] = dbReviews.map((r: any) => ({
              id: r.id,
              orderId: r.order_id,
              clientId: r.client_id,
              providerId: r.provider_id,
              rating: Number(r.rating) || 5,
              comment: r.comment || '',
              tags: r.tags || [],
              photos: r.photos || [],
              createdAt: r.created_at,
            }));
            setReviews((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newReviews = mappedReviews.filter((r) => !existingIds.has(r.id));
              return newReviews.length > 0 ? [...newReviews, ...prev] : prev;
            });
          }

          // Carrega solicitações de serviço do Supabase
          const { data: dbRequests } = await supabase
            .from('service_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (dbRequests && dbRequests.length > 0) {
            const mappedRequests: ServiceRequest[] = dbRequests.map((r: any) => ({
              id: r.id,
              clientId: r.client_id,
              categoryId: r.category_id,
              title: r.title,
              description: r.description,
              urgency: r.urgency || 'normal',
              addressNeighborhood: r.address_neighborhood || 'Centro',
              budgetEstimate: r.budget_estimate ? Number(r.budget_estimate) : undefined,
              photos: r.photos || [],
              status: r.status || 'open',
              createdAt: r.created_at,
            }));
            setRequests((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newReqs = mappedRequests.filter((r) => !existingIds.has(r.id));
              return newReqs.length > 0 ? [...newReqs, ...prev] : prev;
            });
          }
        }
      } catch {
        // Fallback resiliente caso Supabase esteja desconectado
      }
    }

    loadFromSupabase();
  }, [currentUser?.id]);

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
    if (cleanEmail === 'admin@rooserv.com' || cleanEmail === 'admin' || cleanEmail === 'admin@rooserv.com.br') {
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

    let foundUser: UserProfile | null = null;

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
          foundUser = mapDbProfile(dbProfile, dbProfile.id);
        }
      }
    } catch {
      // Prossegue para busca direta no banco
    }

    // 3. Se não autenticou via Auth, busca diretamente na tabela 'profiles' do Supabase por e-mail
    if (!foundUser) {
      try {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (dbProfile) {
          foundUser = mapDbProfile(dbProfile, dbProfile.id);
        }
      } catch {
        // Prossegue para busca local
      }
    }

    // 4. Se não achou no Supabase, busca perfil salvo em localStorage por e-mail
    if (!foundUser) {
      try {
        const localSaved = localStorage.getItem(`rooserv_profile_${cleanEmail}`);
        if (localSaved) {
          foundUser = JSON.parse(localSaved);
        }
      } catch {
        // Prossegue
      }
    }

    // 5. Fallback consistente: se é primeira vez, cria perfil com ID determinístico e estável
    if (!foundUser) {
      const deterministicId = `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const isVini = cleanEmail.includes('vinic') || cleanEmail.includes('vini');
      foundUser = {
        id: deterministicId,
        role: 'provider',
        fullName: isVini ? 'Vinícius Krasnievicz Garcia' : cleanEmail.split('@')[0].toUpperCase(),
        email: cleanEmail,
        phone: isVini ? '(66) 99909-7398' : '(66) 99999-0000',
        neighborhood: 'Centro',
        city: 'Rondonópolis',
        state: 'MT',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    }

    // Salva perfil de forma persistente
    localStorage.setItem(`rooserv_profile_${cleanEmail}`, JSON.stringify(foundUser));
    setCurrentUser(foundUser);
    setCurrentRole(foundUser.role);

    // 6. Restaura os dados do prestador (bio, pix, etc.) associados a este usuário
    let savedProv: any = null;
    try {
      const raw = localStorage.getItem(`rooserv_provider_data_${foundUser.id}`) ||
                  localStorage.getItem(`rooserv_provider_data_${cleanEmail}`);
      if (raw) savedProv = JSON.parse(raw);
    } catch {}

    setProviders((prev) => {
      const exists = prev.some((p) => p.profileId === foundUser!.id || p.profile?.email === cleanEmail);
      if (exists) {
        return prev.map((p) => {
          if (p.profileId === foundUser!.id || p.profile?.email === cleanEmail) {
            return {
              ...p,
              profileId: foundUser!.id,
              profile: foundUser!,
              bio: savedProv?.bio ?? p.bio,
              hourlyRateEstimate: savedProv?.hourlyRateEstimate ?? p.hourlyRateEstimate,
              experienceYears: savedProv?.experienceYears ?? p.experienceYears,
              pixKey: savedProv?.pixKey ?? p.pixKey,
              pixKeyType: savedProv?.pixKeyType ?? p.pixKeyType,
            };
          }
          return p;
        });
      }

      const newProv: ProviderProfile = {
        id: `prv-${foundUser!.id}`,
        profileId: foundUser!.id,
        profile: foundUser!,
        verificationStatus: 'verified',
        bio: savedProv?.bio || 'Professor de Matemática & Especialista em Ensino e Reforço em Rondonópolis.',
        experienceYears: savedProv?.experienceYears || 5,
        hourlyRateEstimate: savedProv?.hourlyRateEstimate || 80,
        pixKeyType: savedProv?.pixKeyType || 'phone',
        pixKey: savedProv?.pixKey || foundUser!.phone,
        averageRating: 5.0,
        totalReviews: 0,
        totalCompletedOrders: 0,
        isAvailable: true,
        categories: [categories[0]],
        portfolio: [],
      };
      return [newProv, ...prev];
    });

    sendInAppNotification({
      title: `👋 Bem-vindo(a), ${foundUser.fullName.split(' ')[0]}!`,
      message: 'Você está conectado à plataforma RooServ Rondonópolis.',
      type: 'system',
    });
    return { success: true, user: foundUser };
  };

  // Método de Cadastro Completo
  const signup = async (data: SignupData): Promise<AuthResult> => {
    const cleanEmail = data.email.trim().toLowerCase();

    let authUserId = `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
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

    localStorage.setItem(`rooserv_profile_${cleanEmail}`, JSON.stringify(newUser));

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

    if (newUser.role === 'provider') {
      const provData = {
        bio: 'Professor de Matemática & Especialista em Ensino e Reforço em Rondonópolis.',
        experienceYears: 5,
        hourlyRateEstimate: 80,
        pixKeyType: 'phone',
        pixKey: newUser.phone,
      };
      localStorage.setItem(`rooserv_provider_data_${newUser.id}`, JSON.stringify(provData));
      localStorage.setItem(`rooserv_provider_data_${cleanEmail}`, JSON.stringify(provData));

      const newProv: ProviderProfile = {
        id: `prv-${newUser.id}`,
        profileId: newUser.id,
        profile: newUser,
        verificationStatus: 'verified',
        bio: provData.bio,
        experienceYears: provData.experienceYears,
        hourlyRateEstimate: provData.hourlyRateEstimate,
        pixKeyType: provData.pixKeyType,
        pixKey: provData.pixKey,
        averageRating: 5.0,
        totalReviews: 0,
        totalCompletedOrders: 0,
        isAvailable: true,
        categories: [categories[0]],
        portfolio: [],
      };
      setProviders((prev) => [newProv, ...prev]);

      try {
        await supabase.from('provider_profiles').upsert([
          {
            id: newProv.id,
            profile_id: newUser.id,
            bio: newProv.bio,
            hourly_rate_estimate: newProv.hourlyRateEstimate,
            experience_years: newProv.experienceYears,
            pix_key: newProv.pixKey,
            pix_key_type: newProv.pixKeyType,
            verification_status: 'verified',
            average_rating: 5.0,
            is_available: true,
          },
        ]);
      } catch {}
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

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    setCurrentUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
    if (updatedUser.email) {
      localStorage.setItem(`rooserv_profile_${updatedUser.email.toLowerCase()}`, JSON.stringify(updatedUser));
    }

    setProviders((prev) =>
      prev.map((p) => (p.profileId === updatedUser.id ? { ...p, profile: updatedUser } : p))
    );

    try {
      await supabase.from('profiles').upsert([
        {
          id: updatedUser.id,
          role: updatedUser.role,
          full_name: updatedUser.fullName,
          email: updatedUser.email,
          phone: updatedUser.phone,
          neighborhood: updatedUser.neighborhood,
          city: updatedUser.city,
          state: updatedUser.state,
          avatar_url: updatedUser.avatarUrl,
        },
      ]);
    } catch {
      // Ignora
    }

    sendInAppNotification({
      title: '✓ Perfil Atualizado com Sucesso!',
      message: 'Suas informações e foto foram salvas.',
      type: 'system',
    });
  };

  const updateProviderProfile = async (data: {
    bio?: string;
    hourlyRateEstimate?: number;
    experienceYears?: number;
    pixKey?: string;
    pixKeyType?: string;
    categories?: ServiceCategory[];
  }) => {
    if (!currentUser) return;

    // 1. Persiste imediatamente no localStorage
    const storageKey = `rooserv_provider_data_${currentUser.id}`;
    let existingSaved = {};
    try {
      const item = localStorage.getItem(storageKey);
      if (item) existingSaved = JSON.parse(item);
    } catch {
      // Ignora
    }

    const mergedProviderData = {
      ...existingSaved,
      ...data,
    };
    localStorage.setItem(storageKey, JSON.stringify(mergedProviderData));
    if (currentUser.email) {
      localStorage.setItem(`rooserv_provider_data_${currentUser.email.toLowerCase()}`, JSON.stringify(mergedProviderData));
    }

    // 2. Atualiza ou insere no estado providers
    setProviders((prev) => {
      const exists = prev.some((p) => p.profileId === currentUser.id);
      if (exists) {
        return prev.map((p) => {
          if (p.profileId === currentUser.id) {
            return {
              ...p,
              bio: data.bio ?? p.bio,
              hourlyRateEstimate: data.hourlyRateEstimate ?? p.hourlyRateEstimate,
              experienceYears: data.experienceYears ?? p.experienceYears,
              pixKey: data.pixKey ?? p.pixKey,
              pixKeyType: data.pixKeyType ?? p.pixKeyType,
              categories: data.categories ?? p.categories,
            };
          }
          return p;
        });
      }

      const newProv: ProviderProfile = {
        id: `prv-${currentUser.id}`,
        profileId: currentUser.id,
        profile: currentUser,
        verificationStatus: 'verified',
        bio: data.bio || 'Professor de Matemática & Reforço Escolar especializado em Rondonópolis.',
        experienceYears: data.experienceYears || 5,
        hourlyRateEstimate: data.hourlyRateEstimate || 80,
        pixKeyType: data.pixKeyType || 'phone',
        pixKey: data.pixKey || currentUser.phone || '',
        averageRating: 5.0,
        totalReviews: 0,
        totalCompletedOrders: 0,
        isAvailable: true,
        categories: data.categories || [categories[0]],
        portfolio: [],
      };
      return [newProv, ...prev];
    });

    // 3. Persiste no Supabase
    try {
      const myProv = providers.find((p) => p.profileId === currentUser.id);
      await supabase.from('provider_profiles').upsert([
        {
          id: myProv?.id || `prv-${currentUser.id}`,
          profile_id: currentUser.id,
          bio: data.bio || myProv?.bio || 'Profissional em Rondonópolis',
          hourly_rate_estimate: data.hourlyRateEstimate || myProv?.hourlyRateEstimate || 80,
          experience_years: data.experienceYears || myProv?.experienceYears || 5,
          pix_key: data.pixKey || myProv?.pixKey || currentUser.phone || '',
          pix_key_type: data.pixKeyType || myProv?.pixKeyType || 'phone',
          verification_status: myProv?.verificationStatus || 'verified',
          average_rating: myProv?.averageRating || 5.0,
          is_available: true,
        },
      ]);
    } catch {
      // Ignora erro de rede
    }

    sendInAppNotification({
      title: '✓ Chave Pix e Perfil Salvos!',
      message: `Chave Pix (${data.pixKeyType || 'telefone'}: ${data.pixKey}) configurada com sucesso.`,
      type: 'system',
    });
  };

  const createServiceRequest = async (data: {
    categoryId: string;
    title: string;
    description: string;
    urgency: 'low' | 'normal' | 'urgent_today';
    neighborhood: string;
    budget?: number;
    photos?: string[];
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
      photos: data.photos || [],
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [newReq, ...prev]);

    // Persiste no Supabase
    try {
      await supabase.from('service_requests').upsert([{
        id: newReq.id,
        client_id: newReq.clientId,
        category_id: newReq.categoryId,
        title: newReq.title,
        description: newReq.description,
        urgency: newReq.urgency,
        address_neighborhood: newReq.addressNeighborhood,
        budget_estimate: newReq.budgetEstimate,
        status: 'open',
      }]);
    } catch {
      // Fallback resiliente
    }

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

  const hireProviderWithEscrow = async (params: {
    providerId: string;
    amount: number;
    paymentMethod: 'pix' | 'credit_card';
    installments: number;
  }): Promise<Order> => {
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

    // Persiste no Supabase
    try {
      await supabase.from('orders').upsert([{
        id: newOrder.id,
        order_number: newOrder.orderNumber,
        client_id: newOrder.clientId,
        provider_id: newOrder.providerId,
        total_amount: newOrder.totalAmount,
        platform_fee_percent: newOrder.platformFeePercent,
        platform_fee_amount: newOrder.platformFeeAmount,
        provider_payout_amount: newOrder.providerPayoutAmount,
        status: newOrder.status,
        payment_method: newOrder.paymentMethod,
        installments_count: newOrder.installmentsCount,
        paid_at: newOrder.paidAt,
      }]);
    } catch {
      // Fallback resiliente
    }

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

  const markOrderAsCompletedByProvider = async (orderId: string, proofPhotos?: string[]) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'completed_by_provider',
              completedAt: new Date().toISOString(),
              photos: proofPhotos || o.photos,
            }
          : o
      )
    );

    // Persiste status no Supabase
    try {
      await supabase.from('orders').update({
        status: 'completed_by_provider',
        completed_at: new Date().toISOString(),
      }).eq('id', orderId);
    } catch {
      // Fallback
    }

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

  const confirmAndReleaseEscrow = async (params: {
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

    // Persiste review e status do pedido no Supabase
    try {
      await supabase.from('orders').update({
        status: 'approved_by_client',
        funds_released_at: new Date().toISOString(),
      }).eq('id', params.orderId);

      await supabase.from('reviews').upsert([{
        id: newReview.id,
        order_id: newReview.orderId,
        client_id: newReview.clientId,
        provider_id: newReview.providerId,
        rating: newReview.rating,
        comment: newReview.comment,
        tags: newReview.tags,
        photos: newReview.photos,
      }]);
    } catch {
      // Fallback
    }

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

  const openDispute = async (orderId: string, reason: string, details: string) => {
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

    // Persiste no Supabase
    try {
      await supabase.from('orders').update({
        status: 'disputed',
        dispute_reason: reason,
        dispute_details: details,
        dispute_opened_at: new Date().toISOString(),
      }).eq('id', orderId);
    } catch {
      // Fallback
    }

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

  const resolveDisputeByAdmin = async (
    orderId: string,
    decision: 'refund_client' | 'release_provider'
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: decision === 'refund_client' ? 'refunded' : 'approved_by_client',
              disputeResolvedAt: new Date().toISOString(),
              fundsReleasedAt: decision === 'release_provider' ? new Date().toISOString() : undefined,
            }
          : o
      )
    );

    // Persiste no Supabase
    try {
      await supabase.from('orders').update({
        status: decision === 'refund_client' ? 'refunded' : 'approved_by_client',
        dispute_resolved_at: new Date().toISOString(),
        funds_released_at: decision === 'release_provider' ? new Date().toISOString() : null,
      }).eq('id', orderId);
    } catch {
      // Fallback
    }

    sendInAppNotification({
      title: '⚖️ Disputa Concluída pela Gestão',
      message: decision === 'refund_client' ? 'Reembolso integral ao cliente.' : 'Valor liberado ao profissional.',
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
          status: decision === 'refund_client' ? 'refunded' : 'approved_by_client',
          disputeResolvedAt: new Date().toISOString(),
        },
      },
    });
  };

  const getAdminStats = () => computeAdminStats(orders, providers);

  const contextValue = useMemo(() => ({
    currentRole,
    setCurrentRole,
    currentUser,
    isAuthenticated,
    isAdmin,
    login,
    signup,
    loginAsAdmin,
    logout,
    updateUserProfile,
    updateProviderProfile,
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
  }), [
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
    notifications,
    activeToast,
    unreadNotificationsCount,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
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
