import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { NavBar } from './components/NavBar';
import { BottomDock } from './components/BottomDock';
import { MobileHeader } from './components/MobileHeader';
import { ToastProvider } from './components/ToastContext';
import Conversations from './pages/Conversations';
import { Dashboard } from './pages/Dashboard';
import { Donate } from './pages/Donate';
import { Inventory } from './pages/Inventory';
import { Logs } from './pages/Logs';
import { Resources } from './pages/Resources';
import { Profile } from './pages/Profile';
import { Uploads } from './pages/Uploads';
import { AuthPage } from './pages/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Store } from './pages/Store';
import AdminDashboard from './pages/AdminDashboard';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { api } from './lib/api';
import type { NotificationItem } from './types';
import { Waste } from './pages/Waste';
import { initializePushNotifications } from './utils/pushNotifications';
import NourishBot from './components/NourishBot';
import { SDGImpact } from './pages/SDGImpact';
import { DynamicTranslationProvider } from './components/AutoTranslate';
import { Premium } from './pages/Premium';
import { SubscriptionPopup } from './components/SubscriptionPopup';

type RenderExtras = {
  storeFocusProductId?: string | null;
  onClearStoreFocus?: () => void;
};

function renderPage(
  page: string,
  onNavigate?: (page: string) => void,
  extras?: RenderExtras,
) {
  switch (page) {
    case 'inventory':
      return <Inventory />;
    case 'logs':
      return <Logs />;
    case 'sdg-impact':
      return <SDGImpact />;
    case 'waste':
      return <Waste />;
    case 'resources':
      return <Resources />;
    case 'donate':
      return <Donate />;
    case 'store':
      return (
        <Store
          onNavigate={onNavigate}
          focusProductId={extras?.storeFocusProductId}
          onFocusConsumed={extras?.onClearStoreFocus}
        />
      );
    case 'checkout':
      return <Checkout />;
    case 'orders':
      return <Orders />;
    case 'messages':
      return <Conversations />;
    case 'uploads':
      return <Uploads />;
    case 'profile':
      return <Profile />;
    case 'premium':
      return <Premium />;
    case 'dashboard':
    default:
      return <Dashboard />;
  }
}

function AppShell() {
  const { t } = useTranslation();
  const { user, status, logout, token } = useAuth();
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [storeFocusProductId, setStoreFocusProductId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [initialPageSet, setInitialPageSet] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionPopupOpen, setSubscriptionPopupOpen] = useState(false);
  const [userUsageStats, setUserUsageStats] = useState<any[]>([]);

  // Handle responsive resizing
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch usage stats
  const fetchUsageStats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.getUsageStats(token);
      if (response.success) {
        setUserUsageStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    }
  }, [token]);

  // Set initial page based on user role
  useEffect(() => {
    if (user && !initialPageSet) {
      setActivePage(user.role === 'admin' ? 'store-admin' : 'dashboard');
      setInitialPageSet(true);

      fetchUsageStats();

      // Show subscription popup after login (with a small delay)
      setTimeout(() => {
        setSubscriptionPopupOpen(true);
      }, 2000);
    }
    if (!user) {
      setInitialPageSet(false);
      setSubscriptionPopupOpen(false);
      setUserUsageStats([]);
    }
  }, [user, initialPageSet, fetchUsageStats]);

  useEffect(() => {
    const handler = (event: WindowEventMap['inventory:view-store-product']) => {
      setStoreFocusProductId(event.detail?.productId ?? null);
      setActivePage('store');
    };

    window.addEventListener('inventory:view-store-product', handler);
    return () => window.removeEventListener('inventory:view-store-product', handler);
  }, []);

  useEffect(() => {
    if (!token) {
      setUnreadMessages(0);
      return;
    }

    let cancelled = false;

    const fetchUnread = async () => {
      try {
        const response = await api.getConversations(token);
        if (cancelled) return;
        const conversations = response.conversations || [];
        const unread = conversations.filter(
          (conv: any) => Number(conv.unreadCount || 0) > 0,
        ).length;
        setUnreadMessages(unread);
      } catch (error) {
        console.error('Failed to load unread conversation count', error);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setNotificationUnreadCount(0);
      return;
    }
    try {
      const response = await api.getNotifications(token);
      const list = response.notifications || [];
      setNotifications(list);
      setNotificationUnreadCount(list.filter((item) => !item.is_read).length);
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  }, [token]);

  useEffect(() => {
    refreshNotifications();
    if (!token) return;
    const interval = setInterval(() => {
      refreshNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [token, refreshNotifications]);

  // Initialize push notifications when user logs in
  useEffect(() => {
    if (token && user) {
      initializePushNotifications(token).catch((error) => {
        console.error('Failed to initialize push notifications:', error);
      });
    }
  }, [token, user]);

  const handleNotificationRead = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await api.markNotificationRead(token, id);
        refreshNotifications();
      } catch (error) {
        console.error('Failed to mark notification read', error);
      }
    },
    [token, refreshNotifications],
  );

  const handleNotificationMarkAll = useCallback(async () => {
    if (!token) return;
    try {
      await api.markAllNotificationsRead(token);
      refreshNotifications();
    } catch (error) {
      console.error('Failed to mark notifications read', error);
    }
  }, [token, refreshNotifications]);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  // Admin gets a completely separate dashboard
  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  // Regular user dashboard
  const links = [
    { key: 'dashboard', label: t('nav.dashboard') },
    { key: 'inventory', label: t('nav.inventory') },
    { key: 'logs', label: t('nav.logs') },
    { key: 'waste', label: t('nav.waste') },
    { key: 'sdg-impact', label: t('nav.sdg') },
    { key: 'resources', label: t('nav.resources') },
    { key: 'donate', label: t('nav.donate') },
    { key: 'store', label: t('nav.store') },
    { key: 'orders', label: 'My Orders' },
    { key: 'messages', label: 'Messages' },
    { key: 'uploads', label: 'Uploads' },
    { key: 'premium', label: 'Premium' },
    { key: 'profile', label: t('nav.profile') },
  ];

  const navBadges = unreadMessages > 0 ? { messages: unreadMessages } : undefined;

  return (
    <div className={`app-layout ${isMobile ? 'mobile-layout' : 'desktop-layout'}`}>
      <DynamicTranslationProvider />

      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          isMenuOpen={mobileMenuOpen}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          userName={user?.full_name || user?.email}
        />
      )}

      {/* Desktop NavBar or Mobile Slide-out Menu */}
      <NavBar
        links={links}
        active={activePage}
        onNavigate={setActivePage}
        userName={user?.full_name || user?.email}
        location={user?.location}
        onLogout={logout}
        badges={navBadges}
        notifications={notifications}
        notificationUnreadCount={notificationUnreadCount}
        onNotificationRefresh={refreshNotifications}
        onNotificationMarkRead={handleNotificationRead}
        onNotificationMarkAll={handleNotificationMarkAll}
        onOpenChatbot={() => {
          setChatbotOpen(true);
          if (isMobile) setMobileMenuOpen(false);
        }}
        rewardPoints={user?.reward_points ?? 0}
        isMobile={isMobile}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <NourishBot isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />

      <main className={`content ${isMobile ? 'mobile-content' : 'desktop-content'}`}>
        <div className={`page-container ${isMobile ? 'mobile-page-container' : 'desktop-page-container'}`}>
          {renderPage(activePage, setActivePage, {
            storeFocusProductId,
            onClearStoreFocus: () => setStoreFocusProductId(null),
          })}
        </div>
      </main>

      {isMobile && (
        <BottomDock
          links={links}
          active={activePage}
          onNavigate={setActivePage}
          badges={navBadges}
        />
      )}

      {/* Subscription Popup */}
      <SubscriptionPopup
        isOpen={subscriptionPopupOpen}
        onClose={() => setSubscriptionPopupOpen(false)}
        onUpgrade={() => {
          setSubscriptionPopupOpen(false);
          setActivePage('premium');
        }}
        userTier={user?.subscription_tier || 'free'}
        usageStats={userUsageStats}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
