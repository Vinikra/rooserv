import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomTabs } from './components/BottomTabs';
import { HomeScreen } from './screens/HomeScreen';
import { ProviderProfileModal } from './screens/ProviderProfileModal';
import { CheckoutModal } from './screens/CheckoutModal';
import { OrdersScreen } from './screens/OrdersScreen';
import { NewRequestScreen } from './screens/NewRequestScreen';
import { ConversationsListScreen } from './screens/ConversationsListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ProviderDashboardScreen } from './screens/ProviderDashboardScreen';
import { AdminScreen } from './screens/AdminScreen';
import { ProviderOnboardingScreen } from './screens/ProviderOnboardingScreen';
import { AuthModal } from './screens/AuthModal';
import { NotificationModal } from './components/NotificationModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { TermsModal } from './components/TermsModal';
import { ReferralModal } from './components/ReferralModal';
import { InAppToast } from './components/InAppToast';
import { ProfileModal } from './screens/ProfileModal';
import { ProviderProfile } from '@servicos/shared';

export const App: React.FC = () => {
  const { currentRole, activeToast, dismissActiveToast } = useApp();

  const [activeTab, setActiveTab] = useState<string>('explore');
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  const [checkoutProvider, setCheckoutProvider] = useState<ProviderProfile | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [activeChatPartner, setActiveChatPartner] = useState<{
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  } | null>(null);

  const handleStartCheckout = (provider: ProviderProfile) => {
    setSelectedProvider(null);
    setCheckoutProvider(provider);
  };

  const renderClientContent = () => {
    switch (activeTab) {
      case 'explore':
        return (
          <HomeScreen
            onSelectProvider={(p) => setSelectedProvider(p)}
            onOpenNewRequest={() => setActiveTab('new_request')}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenReferral={() => setIsReferralOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
          />
        );
      case 'messages':
        return (
          <ConversationsListScreen
            onSelectConversation={(p) => setActiveChatPartner(p)}
            onExplore={() => setActiveTab('explore')}
            onRequestQuote={() => setActiveTab('new_request')}
          />
        );
      case 'new_request':
        return <NewRequestScreen onSuccess={() => setActiveTab('orders')} />;
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

    if (currentRole === 'admin') {
      return <AdminScreen />;
    }

    if (currentRole === 'provider') {
      return renderProviderContent();
    }

    return renderClientContent();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col text-slate-900">
      <PWAInstallBanner />

      {/* Real-time In-App Notification Toast */}
      <InAppToast
        notification={activeToast}
        onClose={dismissActiveToast}
        onNavigate={(tab) => {
          setActiveTab(tab);
          dismissActiveToast();
        }}
      />

      {/* Header com Navegação Integrada (Desktop + Mobile) */}
      {!activeChatPartner && !isOnboardingOpen && (
        <Header
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Container Principal Fluido e Responsivo */}
      <main className="flex-1 w-full flex flex-col">
        {renderMainContent()}
      </main>

      {/* Barra Inferior exclusiva para Dispositivos Móveis (Oculta no Desktop) */}
      {!activeChatPartner && !isOnboardingOpen && (
        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Modais Globais com Backdrop e Centralização Responsiva */}
      {selectedProvider && (
        <ProviderProfileModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onStartCheckout={handleStartCheckout}
          onOpenChat={(p) => {
            setSelectedProvider(null);
            setActiveChatPartner({
              id: p.id,
              name: p.profile?.fullName || 'Profissional',
              avatarUrl: p.profile?.avatarUrl,
              role: 'provider',
              subtitle: `${p.categories[0]?.name || 'Serviços'} • ${p.profile?.neighborhood || 'Roo'}`,
            });
          }}
        />
      )}

      {checkoutProvider && (
        <CheckoutModal
          provider={checkoutProvider}
          onClose={() => setCheckoutProvider(null)}
          onSuccess={() => {
            setCheckoutProvider(null);
            setActiveTab('orders');
          }}
        />
      )}

      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onSuccess={() => setIsAuthOpen(false)}
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
    </div>
  );
};

export default App;
