import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomTabs } from './components/BottomTabs';
import { NotificationModal } from './components/NotificationModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { InAppToast } from './components/InAppToast';
import type { ProviderProfile } from '@servicos/shared';
import { supabase } from './lib/supabase';
import { useDialogAccessibility } from './hooks/useDialogAccessibility';

const HomeScreen = lazy(() => import('./screens/HomeScreen').then((module) => ({ default: module.HomeScreen })));
const ProviderProfileModal = lazy(() => import('./screens/ProviderProfileModal').then((module) => ({ default: module.ProviderProfileModal })));
const OrdersScreen = lazy(() => import('./screens/OrdersScreen').then((module) => ({ default: module.OrdersScreen })));
const NewRequestScreen = lazy(() => import('./screens/NewRequestScreen').then((module) => ({ default: module.NewRequestScreen })));
const ConversationsListScreen = lazy(() => import('./screens/ConversationsListScreen').then((module) => ({ default: module.ConversationsListScreen })));
const ChatScreen = lazy(() => import('./screens/ChatScreen').then((module) => ({ default: module.ChatScreen })));
const ProviderDashboardScreen = lazy(() => import('./screens/ProviderDashboardScreen').then((module) => ({ default: module.ProviderDashboardScreen })));
const AdminScreen = lazy(() => import('./screens/AdminScreen').then((module) => ({ default: module.AdminScreen })));
const ProviderOnboardingScreen = lazy(() => import('./screens/ProviderOnboardingScreen').then((module) => ({ default: module.ProviderOnboardingScreen })));
const AuthModal = lazy(() => import('./screens/AuthModal').then((module) => ({ default: module.AuthModal })));
const TermsModal = lazy(() => import('./components/TermsModal').then((module) => ({ default: module.TermsModal })));
const ReferralModal = lazy(() => import('./components/ReferralModal').then((module) => ({ default: module.ReferralModal })));
const ProfileModal = lazy(() => import('./screens/ProfileModal').then((module) => ({ default: module.ProfileModal })));
const PasswordResetModal = lazy(() => import('./screens/PasswordResetModal').then((module) => ({ default: module.PasswordResetModal })));
const AdminMfaModal = lazy(() => import('./screens/AdminMfaModal').then((module) => ({ default: module.AdminMfaModal })));

const ScreenFallback = () => (
  <div role="status" aria-live="polite" className="flex-1 flex items-center justify-center p-10 text-sm font-bold text-slate-500">
    Carregando…
  </div>
);

export const App: React.FC = () => {
  const {
    currentUser,
    currentRole,
    setCurrentRole,
    isAdmin,
    isAdminMfaVerified,
    refreshAdminSecurityState,
    activeToast,
    dismissActiveToast,
  } = useApp();
  useDialogAccessibility();

  const [activeTab, setActiveTab] = useState<string>('explore');
  const [pendingAuthenticatedTab, setPendingAuthenticatedTab] = useState<string | null>(null);
  const [pendingChatProvider, setPendingChatProvider] = useState<ProviderProfile | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminMfaOpen, setIsAdminMfaOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(
    () => window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordResetOpen(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) setActiveTab('explore');
  }, [currentUser]);

  const navigateToTab = (tab: string) => {
    if (!currentUser && tab !== 'explore') {
      setPendingAuthenticatedTab(tab);
      setIsAuthOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const closeAuth = () => {
    setPendingAuthenticatedTab(null);
    setPendingChatProvider(null);
    setIsAuthOpen(false);
  };

  const completeAuthentication = () => {
    if (pendingChatProvider) {
      setActiveChatPartner({
        id: pendingChatProvider.profileId,
        name: pendingChatProvider.profile?.fullName || 'Profissional',
        avatarUrl: pendingChatProvider.profile?.avatarUrl,
        role: 'provider',
        subtitle: `${pendingChatProvider.categories[0]?.name || 'Serviços'} • ${pendingChatProvider.profile?.neighborhood || 'Rondonópolis'}`,
      });
    } else if (pendingAuthenticatedTab) {
      setActiveTab(pendingAuthenticatedTab);
    }
    setPendingAuthenticatedTab(null);
    setPendingChatProvider(null);
    setIsAuthOpen(false);
  };

  const requestAdminMode = () => {
    if (!currentUser || !isAdmin) return;
    if (currentRole === 'admin') {
      setCurrentRole(currentUser.role === 'provider' ? 'provider' : 'client');
      return;
    }
    if (isAdminMfaVerified) {
      setCurrentRole('admin');
      return;
    }
    setIsAdminMfaOpen(true);
  };

  const completeAdminMfa = useCallback(async () => {
    const verified = await refreshAdminSecurityState();
    if (!verified) throw new Error('O token administrativo não atingiu AAL2.');
    setCurrentRole('admin');
    setIsAdminMfaOpen(false);
  }, [refreshAdminSecurityState, setCurrentRole]);
  
  const [activeChatPartner, setActiveChatPartner] = useState<{
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  } | null>(null);

  const openProviderChat = (provider: ProviderProfile) => {
    setActiveChatPartner({
      id: provider.profileId,
      name: provider.profile?.fullName || 'Profissional',
      avatarUrl: provider.profile?.avatarUrl,
      role: 'provider',
      subtitle: `${provider.categories[0]?.name || 'Serviços'} • ${provider.profile?.neighborhood || 'Rondonópolis'}`,
    });
  };

  const renderClientContent = () => {
    switch (activeTab) {
      case 'explore':
        return (
          <HomeScreen
            onSelectProvider={(p) => setSelectedProvider(p)}
            onOpenNewRequest={() => navigateToTab('new_request')}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenReferral={() => setIsReferralOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
          />
        );
      case 'messages':
        return (
          <ConversationsListScreen
            onSelectConversation={(p) => setActiveChatPartner(p)}
            onExplore={() => navigateToTab('explore')}
            onRequestQuote={() => navigateToTab('new_request')}
          />
        );
      case 'new_request':
        return <NewRequestScreen onSuccess={() => navigateToTab('orders')} />;
      case 'orders':
        return <OrdersScreen />;
      default:
        return null;
    }
  };

  const renderProviderContent = () => {
    if (activeTab === 'orders') {
      return <OrdersScreen />;
    }
    if (activeTab === 'messages') {
      return (
        <ConversationsListScreen
          onSelectConversation={(p) => setActiveChatPartner(p)}
          onExplore={() => setActiveTab('provider_dashboard')}
          onRequestQuote={() => setActiveTab('provider_leads')}
        />
      );
    }
    return <ProviderDashboardScreen onOpenOnboarding={() => setIsOnboardingOpen(true)} />;
  };

  const renderMainContent = () => {
    if (isOnboardingOpen) {
      return (
        <ProviderOnboardingScreen
          onSuccess={() => setIsOnboardingOpen(false)}
          onCancel={() => setIsOnboardingOpen(false)}
        />
      );
    }

    if (activeChatPartner) {
      return (
        <ChatScreen
          recipientUser={activeChatPartner}
          onBack={() => setActiveChatPartner(null)}
          onAcceptProposal={() => {
            setActiveChatPartner(null);
            setActiveTab('orders');
          }}
        />
      );
    }

    if (currentRole === 'admin' && isAdmin && isAdminMfaVerified) {
      return <AdminScreen />;
    }

    if (currentRole === 'provider') {
      return renderProviderContent();
    }

    return renderClientContent();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-brand-700 focus:shadow-xl"
      >
        Pular para o conteúdo principal
      </a>
      <PWAInstallBanner />
      <PWAUpdatePrompt />

      {/* Real-time In-App Notification Toast */}
      <InAppToast
          notification={activeToast}
        onClose={dismissActiveToast}
        onNavigate={(tab) => {
          navigateToTab(tab);
          dismissActiveToast();
        }}
      />

      {/* Header com Navegação Integrada (Desktop + Mobile) */}
      {!activeChatPartner && !isOnboardingOpen && (
        <Header
          onOpenAuth={() => {
            setPendingAuthenticatedTab(null);
            setIsAuthOpen(true);
          }}
          onOpenNotifications={currentUser ? () => setIsNotificationsOpen(true) : undefined}
          onOpenProfile={() => setIsProfileOpen(true)}
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          onRequestAdminMode={requestAdminMode}
        />
      )}

      {/* Container Principal Fluido e Responsivo */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full flex flex-col">
        <Suspense fallback={<ScreenFallback />}>
          {renderMainContent()}
        </Suspense>
      </main>

      {/* Barra Inferior exclusiva para Dispositivos Móveis (Oculta no Desktop) */}
      {!activeChatPartner && !isOnboardingOpen && (
        <BottomTabs activeTab={activeTab} setActiveTab={navigateToTab} />
      )}

      {/* Modais Globais com Backdrop e Centralização Responsiva */}
      <Suspense fallback={null}>
        {selectedProvider && (
        <ProviderProfileModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onOpenChat={(p) => {
            setSelectedProvider(null);
            if (!currentUser) {
              setPendingChatProvider(p);
              setPendingAuthenticatedTab(null);
              setIsAuthOpen(true);
              return;
            }
            openProviderChat(p);
          }}
        />
        )}

      {isAuthOpen && (
        <AuthModal
          onClose={closeAuth}
          onSuccess={completeAuthentication}
          onOpenTerms={() => setIsTermsOpen(true)}
        />
      )}

      {isNotificationsOpen && (
        <NotificationModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          onSelectNotification={(tab) => {
            setActiveTab(tab);
            setIsNotificationsOpen(false);
          }}
        />
      )}

      {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} />}
      {isReferralOpen && <ReferralModal onClose={() => setIsReferralOpen(false)} />}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isPasswordResetOpen && <PasswordResetModal onClose={() => setIsPasswordResetOpen(false)} />}
      {isAdminMfaOpen && (
        <AdminMfaModal
          onClose={() => setIsAdminMfaOpen(false)}
          onVerified={completeAdminMfa}
        />
      )}
      </Suspense>
    </div>
  );
};

export default App;
