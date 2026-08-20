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
import { ProviderProfile } from '@servicos/shared';

export const App: React.FC = () => {
  const { currentRole } = useApp();

  const [activeTab, setActiveTab] = useState<string>('explore');
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  const [checkoutProvider, setCheckoutProvider] = useState<ProviderProfile | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  
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
        return <ConversationsListScreen onSelectConversation={(p) => setActiveChatPartner(p)} />;
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
      return <ConversationsListScreen onSelectConversation={(p) => setActiveChatPartner(p)} />;
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start sm:py-6">
      <div className="w-full sm:max-w-md bg-slate-100 min-h-screen sm:min-h-[850px] sm:max-h-[900px] sm:rounded-[36px] flex flex-col overflow-hidden shadow-2xl relative border sm:border-slate-800">
        <PWAInstallBanner />

        {!activeChatPartner && !isOnboardingOpen && (
          <Header
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
          />
        )}

        <main className="flex-1 overflow-y-auto flex flex-col">
          {renderMainContent()}
        </main>

        {!activeChatPartner && !isOnboardingOpen && (
          <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

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
      </div>
    </div>
  );
};

export default App;
