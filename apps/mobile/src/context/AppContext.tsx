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
import { supabase } from '../lib/supabase';
import { inAppSound } from '../utils/notificationSound';

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

  verifyProviderByAdmin: (providerId: string, status: VerificationStatus) => Promise<void>;
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

function mapDbProfile(prof: any, profileId: string): UserProfile {
  const email = prof?.email || '';
  return {
    id: prof?.id || profileId,
    role: prof?.role || 'client',
    fullName: prof?.full_name || 'Profissional',
    email,
    phone: prof?.phone || '(66) 99888-0000',
    documentCpf: prof?.document_cpf || undefined,
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
    verificationStatus: p.verification_status || 'pending',
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
    categories: (p.provider_categories || [])
      .map((relation: any) => relation.service_categories)
      .filter(Boolean)
      .map(mapDbCategory),
    portfolio: (p.portfolio_items || []).map((item: any) => ({
      id: item.id,
      providerId: item.provider_id,
      title: item.title,
      description: item.description || '',
      beforeImageUrl: item.before_image_url || undefined,
      afterImageUrl: item.after_image_url,
      createdAt: item.created_at,
    })),
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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('client');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

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
  const isAdmin = currentUser?.role === 'admin';

  // A sessão do Supabase Auth é a única fonte de autenticação. Dados locais
  // nunca restauram usuário ou papel sem uma sessão válida no servidor.
  useEffect(() => {
    let active = true;

    const hydrateAuthenticatedProfile = async (authUserId?: string) => {
      if (!authUserId) {
        if (active) {
          setCurrentUser(null);
          setCurrentRole('client');
          setOrders([]);
        }
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUserId)
        .single();

      if (!active) return;
      if (error || !profile) {
        setCurrentUser(null);
        setCurrentRole('client');
        return;
      }

      const authenticatedProfile = mapDbProfile(profile, profile.id);
      setCurrentUser(authenticatedProfile);
      setCurrentRole(authenticatedProfile.role);
    };

    supabase.auth.getSession().then(({ data }) => {
      void hydrateAuthenticatedProfile(data.session?.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateAuthenticatedProfile(session?.user.id);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Sincronização inicial com o Supabase
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const { data: dbCategories, error: catError } = await supabase
          .from('service_categories')
          .select('*')
          .order('sort_order', { ascending: true });

        if (catError) throw catError;
        setCategories((dbCategories || []).map(mapDbCategory));

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
              neighborhood,
              city,
              state,
              avatar_url,
              is_active,
              created_at
            ),
            provider_categories (
              service_categories (*)
            ),
            portfolio_items (*)
          `);

        if (provError) throw provError;
        setProviders((dbProviders || []).map(mapDbProvider));

        // Carrega pedidos do Supabase
        if (currentUser?.id) {
          // A RLS já restringe o resultado ao cliente/prestador autenticado.
          // Evita comparar provider_id com profiles.id, que são entidades diferentes.
          const { data: dbOrders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          if (ordersError) throw ordersError;
          const mappedOrders: Order[] = (dbOrders || []).map((o: any) => ({
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
          setOrders(mappedOrders);

          // Carrega reviews do Supabase
          const { data: dbReviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          if (reviewsError) throw reviewsError;
          const mappedReviews: Review[] = (dbReviews || []).map((r: any) => ({
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
          setReviews(mappedReviews);

          // Carrega solicitações de serviço do Supabase
          const { data: dbRequests, error: requestsError } = await supabase
            .from('service_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (requestsError) throw requestsError;
          const mappedRequests: ServiceRequest[] = (dbRequests || []).map((r: any) => ({
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
          setRequests(mappedRequests);
        }
      } catch (error) {
        console.error('[RooServ] Falha ao carregar dados do Supabase:', error);
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
        .eq('user_id', data.user.id)
        .single();

      if (dbProfile) {
        foundUser = mapDbProfile(dbProfile, dbProfile.id);
      } else {
        return { success: false, error: 'Perfil não encontrado para este usuário.' };
      }
    } catch {
      return { success: false, error: 'Erro de comunicação com o servidor de autenticação.' };
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
        categories: categories[0] ? [categories[0]] : [],
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
        await supabase.from('profiles').delete().eq('id', newUser.id);
        await supabase.auth.signOut();
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Falha ao criar perfil de prestador.',
        };
      }

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
        .select('*')
        .eq('user_id', data.user.id)
        .single();
      
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        return { success: false, error: 'Acesso administrativo não autorizado.' };
      }
      
      const adminProfile = mapDbProfile(profile, profile.id);
      setCurrentUser(adminProfile);
      setCurrentRole('admin');
      sendInAppNotification({
        title: '🛡️ Gestão RooServ',
        message: 'Acesso liberado às métricas e conciliação financeira.',
        type: 'system',
      });
      return { success: true, user: adminProfile };
    } catch {
      return { success: false, error: 'Erro ao verificar credenciais administrativas.' };
    }
  };

  // Logout
  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Não foi possível encerrar a sessão: ${error.message}`);

    setCurrentUser(null);
    setCurrentRole('client');
    setOrders([]);
  };

  const deleteAccount = async (): Promise<boolean> => {
    if (!currentUser) throw new Error('Nenhuma conta autenticada.');
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error || data?.deleted !== true) {
      throw new Error(`Não foi possível excluir a conta: ${error?.message || 'confirmação ausente'}`);
    }

    await supabase.auth.signOut({ scope: 'local' });
    setCurrentUser(null);
    setCurrentRole('client');
    setOrders([]);
    return true;
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) throw new Error('Faça login para atualizar o perfil.');
    const updates = {
      full_name: data.fullName ?? currentUser.fullName,
      phone: data.phone ?? currentUser.phone,
      document_cpf: data.documentCpf ?? currentUser.documentCpf,
      neighborhood: data.neighborhood ?? currentUser.neighborhood,
      city: data.city ?? currentUser.city,
      state: data.state ?? currentUser.state,
      avatar_url: data.avatarUrl ?? currentUser.avatarUrl,
      updated_at: new Date().toISOString(),
    };
    const { data: savedProfile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', currentUser.id)
      .select('*')
      .single();
    if (error || !savedProfile) {
      throw new Error(`Não foi possível salvar o perfil: ${error?.message || 'resposta vazia'}`);
    }

    const updatedUser = mapDbProfile(savedProfile, currentUser.id);
    setCurrentUser(updatedUser);
    setCurrentRole(updatedUser.role);
    setProviders((prev) => prev.map((p) =>
      p.profileId === updatedUser.id ? { ...p, profile: updatedUser } : p
    ));

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
    if (!currentUser) throw new Error('Faça login para atualizar o perfil profissional.');
    const myProvider = providers.find((p) => p.profileId === currentUser.id);
    if (!myProvider) throw new Error('Perfil profissional não encontrado.');

    const { data: savedProvider, error } = await supabase
      .from('provider_profiles')
      .update({
        bio: data.bio ?? myProvider.bio,
        hourly_rate_estimate: data.hourlyRateEstimate ?? myProvider.hourlyRateEstimate,
        experience_years: data.experienceYears ?? myProvider.experienceYears,
        pix_key: data.pixKey ?? myProvider.pixKey,
        pix_key_type: data.pixKeyType ?? myProvider.pixKeyType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', myProvider.id)
      .select('*')
      .single();
    if (error || !savedProvider) {
      throw new Error(`Não foi possível salvar o perfil profissional: ${error?.message || 'resposta vazia'}`);
    }

    if (data.categories) {
      const { error: deleteCategoriesError } = await supabase
        .from('provider_categories')
        .delete()
        .eq('provider_id', myProvider.id);
      if (deleteCategoriesError) throw new Error(`Falha ao atualizar categorias: ${deleteCategoriesError.message}`);

      if (data.categories.length > 0) {
        const { error: insertCategoriesError } = await supabase.from('provider_categories').insert(
          data.categories.map((category) => ({ provider_id: myProvider.id, category_id: category.id }))
        );
        if (insertCategoriesError) throw new Error(`Falha ao atualizar categorias: ${insertCategoriesError.message}`);
      }
    }

    setProviders((prev) => prev.map((provider) => provider.id === myProvider.id ? {
      ...provider,
      bio: savedProvider.bio || '',
      hourlyRateEstimate: Number(savedProvider.hourly_rate_estimate) || undefined,
      experienceYears: Number(savedProvider.experience_years) || 0,
      pixKey: savedProvider.pix_key || '',
      pixKeyType: (savedProvider.pix_key_type || undefined) as ProviderProfile['pixKeyType'],
      categories: data.categories ?? provider.categories,
    } : provider));

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
    if (!currentUser) throw new Error('Faça login para publicar uma solicitação.');
    const category = categories.find((c) => c.id === data.categoryId);
    if (!category) throw new Error('Categoria de serviço inválida.');
    const client = currentUser;
    const reqUuid = generateUuid();

    const newReq: ServiceRequest = {
      id: reqUuid,
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

    const { data: savedRequest, error } = await supabase.from('service_requests').insert([{
        id: reqUuid,
        client_id: client.id,
        category_id: category.id,
        title: newReq.title,
        description: newReq.description,
        urgency: newReq.urgency,
        address_neighborhood: newReq.addressNeighborhood,
        budget_estimate: newReq.budgetEstimate,
        photos: newReq.photos,
        status: 'open',
      }]).select('*').single();
    if (error || !savedRequest) {
      throw new Error(`Não foi possível publicar a solicitação: ${error?.message || 'resposta vazia'}`);
    }

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

  const verifyProviderByAdmin = async (providerId: string, status: VerificationStatus) => {
    if (status !== 'verified' && status !== 'rejected') {
      throw new Error('Decisão de verificação inválida.');
    }
    const { error } = await supabase.rpc('review_provider_kyc', {
      p_provider_id: providerId,
      p_decision: status,
      p_rejection_reason: status === 'rejected' ? 'Documentação recusada pela gestão' : null,
    });
    if (error) throw new Error(`Não foi possível revisar o KYC: ${error.message}`);

    setProviders((prev) => prev.map((provider) => provider.id === providerId ? {
      ...provider,
      verificationStatus: status,
      verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
      isAvailable: status === 'verified',
    } : provider));
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
