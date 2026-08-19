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
  
  // Estado de Conversa Ativa no Chat
  const [activeChatPartner, setActiveChatPartner] = useState<{
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  } | null>(null);

  // Abrir checkout a partir do perfil do prestador
  const handleStartCheckout = (provider: ProviderProfile) => {
    setSelectedProvider(null);
    setCheckoutProvider(provider);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start sm:py-6">
      {/* Container Responsivo do Dispositivo */}
      <div className="w-full sm:max-w-md bg-slate-100 min-h-screen sm:min-h-[850px] sm:max-h-[900px] sm:rounded-[36px] flex flex-col overflow-hidden shadow-2xl relative border sm:border-slate-800">
        
        {/* Banner de Instalação PWA */}
        <PWAInstallBanner />

        {/* Top Header com Seletor de Bairro e Alternador de Papel (escondido dentro do chat full ou onboarding) */}
        {!activeChatPartner && !isOnboardingOpen && (
          <Header
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
          />
        )}

        {/* Área Central de Conteúdo com Scroll */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {isOnboardingOpen ? (
            <ProviderOnboardingScreen
              onSuccess={() => setIsOnboardingOpen(false)}
              onCancel={() => setIsOnboardingOpen(false)}
            />
          ) : activeChatPartner ? (
            <ChatScreen
              recipientUser={activeChatPartner}
              onBack={() => setActiveChatPartner(null)}
              onAcceptProposal={(amount) => {
                setActiveChatPartner(null);
                setActiveTab('orders');
              }}
            />
          ) : currentRole === 'admin' ? (
            <AdminScreen />
          ) : currentRole === 'provider' ? (
            activeTab === 'orders' ? (
              <OrdersScreen />
            ) : activeTab === 'messages' ? (
              <ConversationsListScreen onSelectConversation={(p) => setActiveChatPartner(p)} />
            ) : (
              <ProviderDashboardScreen onOpenOnboarding={() => setIsOnboardingOpen(true)} />
            )
          ) : (
            // Modo Cliente
            <>
              {activeTab === 'explore' && (
                <HomeScreen
                  onSelectProvider={(p) => setSelectedProvider(p)}
                  onOpenNewRequest={() => setActiveTab('new_request')}
                  onOpenOnboarding={() => setIsOnboardingOpen(true)}
                  onOpenReferral={() => setIsReferralOpen(true)}
                  onOpenTerms={() => setIsTermsOpen(true)}
                />
              )}

              {activeTab === 'messages' && (
                <ConversationsListScreen onSelectConversation={(p) => setActiveChatPartner(p)} />
              )}

              {activeTab === 'new_request' && (
                <NewRequestScreen onSuccess={() => setActiveTab('orders')} />
              )}

              {activeTab === 'orders' && <OrdersScreen />}
            </>
          )}
        </main>

        {/* Barra de Navegação Inferior */}
        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Modal de Perfil Detalhado do Prestador */}
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
                subtitle: `${p.categories[0]?.name || 'Serviços'} • ${p.profile?.neighborhood}`,
              });
            }}
          />
        )}

        {/* Modal de Pagamento Seguro com Custódia (Escrow) */}
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

        {/* Modal de Autenticação / Login */}
        {isAuthOpen && (
          <AuthModal
            onClose={() => setIsAuthOpen(false)}
            onSuccess={() => setIsAuthOpen(false)}
          />
        )}

        {/* Modal de Notificações */}
        {isNotificationsOpen && (
          <NotificationModal
            onClose={() => setIsNotificationsOpen(false)}
            onNavigateTab={(tab) => {
              setIsNotificationsOpen(false);
              setActiveTab(tab);
            }}
          />
        )}

        {/* Modal de Termos de Uso & Garantia */}
        {isTermsOpen && (
          <TermsModal onClose={() => setIsTermsOpen(false)} />
        )}

        {/* Modal de Indicação de Vizinhos */}
        {isReferralOpen && (
          <ReferralModal onClose={() => setIsReferralOpen(false)} />
        )}
      </div>
    </div>
  );
};
export default App;
