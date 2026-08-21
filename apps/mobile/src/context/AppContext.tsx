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
  deleteAccount: () => Promise<boolean>;
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

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeterministicUuid(emailOrId: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(emailOrId)) {
    return emailOrId;
  }
  const clean = emailOrId.trim().toLowerCase();
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const p1 = Math.abs(hash1).toString(16).padStart(8, '0').slice(0, 8);
  const p2 = Math.abs(hash2).toString(16).padStart(4, '0').slice(0, 4);
  const p3 = '4' + Math.abs(hash1 ^ hash2).toString(16).padStart(3, '0').slice(0, 3);
  const p4 = '8' + Math.abs(hash2).toString(16).padStart(3, '0').slice(0, 3);
  const p5 = (Math.abs(hash1) + Math.abs(hash2)).toString(16).padStart(12, '0').slice(0, 12);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function getSavedAvatar(emailOrId?: string): string | null {
  if (!emailOrId) return null;
  try {
    const clean = emailOrId.trim().toLowerCase();
    return localStorage.getItem(`rooserv_avatar_${clean}`) || null;
  } catch {
    return null;
  }
}

function mapDbProfile(prof: any, profileId: string): UserProfile {
  const email = prof?.email || '';
  const localAvatar = getSavedAvatar(email) || getSavedAvatar(prof?.id) || getSavedAvatar(profileId);
  return {
    id: prof?.id || profileId,
    role: prof?.role || 'provider',
    fullName: prof?.full_name || 'Profissional',
    email,
    phone: prof?.phone || '(66) 99888-0000',
    neighborhood: prof?.neighborhood || 'Centro',
    city: prof?.city || 'Rondonópolis',
    state: prof?.state || 'MT',
    avatarUrl: localAvatar || prof?.avatar_url || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150',
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

  const [providers, setProviders] = useState<ProviderProfile[]>(() => {
    try {
      const saved = localStorage.getItem('rooserv_providers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PROVIDERS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('rooserv_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_ORDERS;
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const saved = localStorage.getItem('rooserv_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_REVIEWS;
  });

  const [requests, setRequests] = useState<ServiceRequest[]>(() => {
    try {
      const saved = localStorage.getItem('rooserv_requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_REQUESTS;
  });

  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Todos os Bairros');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);

  // Sincronização contínua com o LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('rooserv_providers', JSON.stringify(providers));
    } catch {}
  }, [providers]);

  useEffect(() => {
    try {
      localStorage.setItem('rooserv_orders', JSON.stringify(orders));
    } catch {}
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('rooserv_reviews', JSON.stringify(reviews));
    } catch {}
  }, [reviews]);

  useEffect(() => {
    try {
      localStorage.setItem('rooserv_requests', JSON.stringify(requests));
    } catch {}
  }, [requests]);

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
          const mappedDbProviders = dbProviders.map(mapDbProvider);
          setProviders((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            for (const p of mappedDbProviders) {
              map.set(p.id, p);
            }
            return Array.from(map.values());
          });
        }

        // Carrega pedidos do Supabase
        if (currentUser?.id) {
          // A RLS já restringe o resultado ao cliente/prestador autenticado.
          // Evita comparar provider_id com profiles.id, que são entidades diferentes.
          const { data: dbOrders } = await supabase
            .from('orders')
            .select('*')
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
              startedAt: o.started_at,
              completedAt: o.completed_at,
              fundsReleasedAt: o.funds_released_at,
              completionProofPhotos: o.completion_proof_photos || [],
              photos: o.completion_proof_photos || [],
              disputeReason: o.dispute_reason,
              disputeDetails: o.dispute_details,
              disputeOpenedBy: o.dispute_opened_by,
              disputeOpenedAt: o.dispute_opened_at,
              disputeResolution: o.dispute_resolution,
              refundRequestedAt: o.refund_requested_at,
              disputeResolvedAt: o.dispute_resolved_at,
              createdAt: o.created_at,
            }));
            setOrders((prev) => {
              const map = new Map(prev.map((o) => [o.id, o]));
              for (const ord of mappedOrders) {
                map.set(ord.id, { ...(map.get(ord.id) || {}), ...ord });
              }
              return Array.from(map.values());
            });
          }

          // Carrega reviews do Supabase
          const { data: dbReviews } = await supabase
            .from('reviews')
            .select('*')
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
              const map = new Map(prev.map((r) => [r.id, r]));
              for (const rev of mappedReviews) {
                map.set(rev.id, { ...(map.get(rev.id) || {}), ...rev });
              }
              return Array.from(map.values());
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
              const map = new Map(prev.map((r) => [r.id, r]));
              for (const req of mappedRequests) {
                map.set(req.id, { ...(map.get(req.id) || {}), ...req });
              }
              return Array.from(map.values());
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
    let foundUser: UserProfile | null = null;

    // 2. Tenta autenticar via Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error || !data?.user) {
        return { success: false, error: 'Credenciais inválidas. Verifique seu e-mail e senha.' };
      }

      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .single();

      if (dbProfile) {
        foundUser = mapDbProfile(dbProfile, dbProfile.id);
      } else {
        return { success: false, error: 'Perfil não encontrado para este usuário.' };
      }
    } catch {
      return { success: false, error: 'Erro de comunicação com o servidor de autenticação.' };
    }

    // Restaura avatar customizado salvo localmente se existir
    const localAvatar = getSavedAvatar(cleanEmail) || getSavedAvatar(foundUser.id);
    if (localAvatar) {
      foundUser.avatarUrl = localAvatar;
    }

    // Salva perfil de forma persistente
    localStorage.setItem(`rooserv_profile_${cleanEmail}`, JSON.stringify(foundUser));
    if (foundUser.avatarUrl) {
      localStorage.setItem(`rooserv_avatar_${cleanEmail}`, foundUser.avatarUrl);
      localStorage.setItem(`rooserv_avatar_${foundUser.id}`, foundUser.avatarUrl);
    }
    setCurrentUser(foundUser);
    setCurrentRole(foundUser.role);

    if (foundUser.role === 'admin') {
      sendInAppNotification({
        title: '🛡️ Modo Gestor Autenticado',
        message: 'Painel de administração master liberado com métricas financeiras e KYC.',
        type: 'system',
      });
      return { success: true, user: foundUser };
    }

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

    if (!data.password) {
      return { success: false, error: 'A senha é obrigatória para o cadastro.' };
    }

    let authUserId = '';
    try {
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

      if (error || !authData?.user) {
        return { success: false, error: error?.message || 'Falha ao criar conta no sistema.' };
      }
      authUserId = authData.user.id;
    } catch {
      return { success: false, error: 'Erro de comunicação com o servidor de autenticação.' };
    }

    const newUser: UserProfile = {
      id: authUserId,
      role: data.role === 'provider' ? 'provider' : 'client',
      fullName: data.fullName,
      email: cleanEmail,
      phone: data.phone,
      documentCpf: data.documentCpf,
      neighborhood: data.neighborhood || 'Centro',
      city: 'Rondonópolis',
      state: 'MT',
      avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const { error: profileInsertError } = await supabase.from('profiles').insert([
        {
          id: newUser.id,
          user_id: authUserId,
          role: newUser.role,
          full_name: newUser.fullName,
          email: newUser.email,
          phone: newUser.phone,
          document_cpf: newUser.documentCpf,
          neighborhood: newUser.neighborhood,
          city: newUser.city,
          state: newUser.state,
          avatar_url: newUser.avatarUrl,
        },
      ]);
    if (profileInsertError) {
      await supabase.auth.signOut();
      return { success: false, error: `Falha ao criar perfil: ${profileInsertError.message}` };
    }

    localStorage.setItem(`rooserv_profile_${cleanEmail}`, JSON.stringify(newUser));

    if (newUser.role === 'provider') {
      const provData = {
        bio: 'Professor de Matemática & Especialista em Ensino e Reforço em Rondonópolis.',
        experienceYears: 5,
        hourlyRateEstimate: 80,
        pixKeyType: 'phone',
        pixKey: newUser.phone,
      };
      const newProv: ProviderProfile = {
        id: generateUuid(),
        profileId: newUser.id,
        profile: newUser,
        verificationStatus: 'pending',
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
      try {
        const { error: providerInsertError } = await supabase.from('provider_profiles').insert([
          {
            id: newProv.id,
            profile_id: newUser.id,
            bio: newProv.bio,
            hourly_rate_estimate: newProv.hourlyRateEstimate,
            experience_years: newProv.experienceYears,
            pix_key: newProv.pixKey,
            pix_key_type: newProv.pixKeyType,
            verification_status: 'pending',
            average_rating: 5.0,
            is_available: true,
          },
        ]);
        if (providerInsertError) throw providerInsertError;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Falha ao criar perfil de prestador.',
        };
      }

      localStorage.setItem(`rooserv_provider_data_${newUser.id}`, JSON.stringify(provData));
      localStorage.setItem(`rooserv_provider_data_${cleanEmail}`, JSON.stringify(provData));
      setProviders((prev) => [newProv, ...prev]);
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
    // Admin login requires email:password in format 'email|password' or just password with admin email
    const parts = secretOrPass.includes('|') ? secretOrPass.split('|') : ['admin@rooserv.com', secretOrPass];
    const [adminEmail, adminPass] = parts;
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim().toLowerCase(),
        password: adminPass.trim(),
      });
      
      if (error || !data?.user) {
        return { success: false, error: 'Credenciais administrativas inválidas.' };
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', adminEmail.trim().toLowerCase())
        .single();
      
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        return { success: false, error: 'Acesso administrativo não autorizado.' };
      }
      
      setCurrentUser(ADMIN_PROFILE);
      setCurrentRole('admin');
      sendInAppNotification({
        title: '🛡️ Gestão RooServ',
        message: 'Acesso liberado às métricas e conciliação financeira.',
        type: 'system',
      });
      return { success: true, user: ADMIN_PROFILE };
    } catch {
      return { success: false, error: 'Erro ao verificar credenciais administrativas.' };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora
    }

    if (currentUser?.email) {
      const cleanEmail = currentUser.email.toLowerCase();
      localStorage.removeItem(`rooserv_profile_${cleanEmail}`);
      localStorage.removeItem(`rooserv_avatar_${cleanEmail}`);
      if (currentUser.id) {
        localStorage.removeItem(`rooserv_avatar_${currentUser.id}`);
      }
    }

    setCurrentUser(null);
    setCurrentRole('client');
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const deleteAccount = async (): Promise<boolean> => {
    if (!currentUser?.email) return false;
    const cleanEmail = currentUser.email.toLowerCase();

    try {
      // 1. Attempt admin user deletion
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await supabase.auth.admin.deleteUser(currentUser.id);
    } catch {
      // Ignore if it fails from frontend
    }

    try {
      // 2. Delete from profiles table
      await supabase.from('profiles').delete().eq('email', cleanEmail);
    } catch {
      // Ignore
    }

    // 3. Clear localStorage keys starting with rooserv_
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('rooserv_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 4. Logout
    await logout();
    
    sendInAppNotification({
      title: 'Conta Excluída',
      message: 'Sua conta e dados foram removidos com sucesso.',
      type: 'system',
    });

    return true;
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
    if (updatedUser.avatarUrl) {
      if (updatedUser.email) {
        localStorage.setItem(`rooserv_avatar_${updatedUser.email.toLowerCase()}`, updatedUser.avatarUrl);
      }
      if (updatedUser.id) {
        localStorage.setItem(`rooserv_avatar_${updatedUser.id}`, updatedUser.avatarUrl);
      }
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
      const provUuid = getOrCreateDeterministicUuid(currentUser.id || currentUser.email || 'provider');
      const myProv = providers.find((p) => p.profileId === currentUser.id);
      await supabase.from('provider_profiles').upsert([
        {
          id: provUuid,
          profile_id: provUuid,
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
    const reqUuid = generateUuid();
    const clientUuid = getOrCreateDeterministicUuid(client.id || client.email || 'guest-visitor');
    const catUuid = getOrCreateDeterministicUuid(category.id);

    const newReq: ServiceRequest = {
      id: reqUuid,
      clientId: clientUuid,
      client,
      categoryId: catUuid,
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
        id: reqUuid,
        client_id: clientUuid,
        category_id: catUuid,
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
    if (!currentUser) {
      throw new Error('Faça login antes de iniciar uma contratação.');
    }

    if (params.paymentMethod !== 'pix') {
      throw new Error('Pagamento com cartão ainda não está disponível.');
    }

    const provider = providers.find((p) => p.id === params.providerId);
    if (!provider) {
      throw new Error('Prestador não encontrado.');
    }

    const split = calculateServiceSplit(params.amount, 12.0);
    const client = currentUser;
    const orderUuid = generateUuid();
    const clientUuid = client.id;
    const providerUuid = params.providerId;

    const randomSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
      ? (1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000))
      : 5521;

    const newOrder: Order = {
      id: orderUuid,
      orderNumber: `SRV-2026-${randomSuffix}`,
      clientId: clientUuid,
      client,
      providerId: providerUuid,
      provider,
      totalAmount: split.totalAmount,
      platformFeePercent: split.platformFeePercent,
      platformFeeAmount: split.platformFeeAmount,
      providerPayoutAmount: split.providerPayoutAmount,
      status: 'awaiting_payment',
      paymentMethod: params.paymentMethod,
      installmentsCount: params.installments,
      createdAt: new Date().toISOString(),
    };

    // O pedido precisa existir antes da cobrança. A confirmação de custódia
    // acontece exclusivamente pelo webhook autenticado do gateway.
    const { error } = await supabase.from('orders').insert([{
        id: orderUuid,
        order_number: newOrder.orderNumber,
        client_id: clientUuid,
        provider_id: providerUuid,
        total_amount: newOrder.totalAmount,
        platform_fee_percent: newOrder.platformFeePercent,
        platform_fee_amount: newOrder.platformFeeAmount,
        provider_payout_amount: newOrder.providerPayoutAmount,
        status: newOrder.status,
        payment_method: newOrder.paymentMethod,
        installments_count: newOrder.installmentsCount,
      }]);

    if (error) {
      throw new Error(`Não foi possível criar o pedido: ${error.message}`);
    }

    setOrders((prev) => [newOrder, ...prev]);

    sendInAppNotification({
      title: 'Pedido criado — aguardando pagamento',
      message: `A cobrança de R$ ${split.totalAmount.toFixed(2)} será confirmada somente após o retorno do Asaas.`,
      type: 'payment',
      actionTab: 'orders',
    });

    return newOrder;
  };

  const markOrderAsCompletedByProvider = async (orderId: string, proofPhotos?: string[]) => {
    const { error } = await supabase.rpc('complete_order_by_provider', {
      p_order_id: orderId,
      p_proof_photos: proofPhotos || [],
    });
    if (error) throw new Error(`Não foi possível concluir o serviço: ${error.message}`);

    const completedAt = new Date().toISOString();
    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      status: 'completed_by_provider',
      startedAt: o.startedAt || completedAt,
      completedAt,
      completionProofPhotos: proofPhotos || [],
      photos: proofPhotos || o.photos,
    } : o));

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
    if (!targetOrder || !currentUser) throw new Error('Pedido ou usuário não encontrado.');

    const { data, error } = await supabase.rpc('release_order_escrow', {
      p_order_id: params.orderId,
      p_rating: params.rating,
      p_comment: params.comment,
      p_tags: params.tags,
    });
    if (error) throw new Error(`Não foi possível liberar a custódia: ${error.message}`);

    const releasedAt = new Date().toISOString();
    setOrders((prev) => prev.map((o) => o.id === params.orderId ? {
      ...o,
      status: 'approved_by_client',
      fundsReleasedAt: releasedAt,
      completedAt: o.completedAt || releasedAt,
    } : o));

    const newReview: Review = {
      id: data?.review_id || generateUuid(),
      orderId: params.orderId,
      clientId: currentUser.id,
      client: currentUser,
      providerId: targetOrder.providerId,
      rating: params.rating,
      comment: params.comment,
      tags: params.tags,
      photos: [],
      createdAt: releasedAt,
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

  const openDispute = async (orderId: string, reason: string, details: string) => {
    const { error } = await supabase.rpc('open_order_dispute', {
      p_order_id: orderId,
      p_reason: reason,
      p_details: details,
    });
    if (error) throw new Error(`Não foi possível abrir a disputa: ${error.message}`);

    const disputeOpenedAt = new Date().toISOString();
    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      status: 'disputed',
      disputeReason: reason,
      disputeDetails: details,
      disputeOpenedBy: currentUser?.id,
      disputeOpenedAt,
      disputeResolution: undefined,
      refundRequestedAt: undefined,
      disputeResolvedAt: undefined,
    } : o));

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
    const { data, error } = await supabase.rpc('resolve_order_dispute', {
      p_order_id: orderId,
      p_decision: decision,
    });
    if (error) throw new Error(`Não foi possível resolver a disputa: ${error.message}`);

    const resolvedAt = new Date().toISOString();
    const refundPending = decision === 'refund_client' && data?.gateway_action_required === true;
    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      status: decision === 'release_provider' ? 'approved_by_client' : 'disputed',
      disputeResolution: decision,
      refundRequestedAt: refundPending ? resolvedAt : o.refundRequestedAt,
      disputeResolvedAt: decision === 'release_provider' ? resolvedAt : o.disputeResolvedAt,
      fundsReleasedAt: decision === 'release_provider' ? resolvedAt : o.fundsReleasedAt,
    } : o));

    sendInAppNotification({
      title: decision === 'refund_client'
        ? '⚖️ Reembolso Autorizado pela Gestão'
        : '⚖️ Disputa Concluída pela Gestão',
      message: decision === 'refund_client'
        ? 'Reembolso autorizado e aguardando processamento pelo Asaas.'
        : 'Valor em custódia liberado ao profissional.',
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
          status: decision === 'release_provider' ? 'approved_by_client' : 'disputed',
          disputeResolution: decision,
          refundRequestedAt: refundPending ? resolvedAt : undefined,
          disputeResolvedAt: decision === 'release_provider' ? resolvedAt : undefined,
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
    deleteAccount,
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
