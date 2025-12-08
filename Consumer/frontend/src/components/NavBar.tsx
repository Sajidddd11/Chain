import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationBell } from './NotificationBell';
import {
  Bot,
  LayoutDashboard,
  Package,
  BarChart3,
  Trash2,
  Globe,
  BookOpen,
  Heart,
  ShoppingBag,
  ShoppingCart,
  MessageSquare,
  Upload,
  User,
  LogOut,
  ChevronRight
} from 'lucide-react';
import type { NotificationItem } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';

type NavLink = {
  label: string;
  key: string;
};

type NavBarProps = {
  links: NavLink[];
  active: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  userName?: string;
  location?: string | null;
  badges?: Record<string, number | undefined>;
  notifications?: NotificationItem[];
  notificationUnreadCount?: number;
  onNotificationRefresh?: () => void;
  onNotificationMarkRead?: (id: string) => void;
  onNotificationMarkAll?: () => void;
  onOpenChatbot?: () => void;
  rewardPoints?: number | null;
};

const iconMap: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  inventory: Package,
  logs: BarChart3,
  waste: Trash2,
  'sdg-impact': Globe,
  resources: BookOpen,
  donate: Heart,
  store: ShoppingBag,
  orders: ShoppingCart,
  messages: MessageSquare,
  uploads: Upload,
  profile: User,
};

export function NavBar({
  links,
  active,
  onNavigate,
  onLogout,
  userName,
  location,
  badges,
  notifications = [],
  notificationUnreadCount = 0,
  onNotificationRefresh,
  onNotificationMarkRead,
  onNotificationMarkAll,
  onOpenChatbot,
  rewardPoints,
  isMobile = false,
  isOpen = false,
  onClose,
}: NavBarProps & { isMobile?: boolean; isOpen?: boolean; onClose?: () => void }) {
  const { t } = useTranslation();
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Close menu when navigating on mobile
  const handleNavigate = (key: string) => {
    onNavigate(key);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div className="mobile-nav-overlay" onClick={onClose} />
      )}
      
      <aside className={`sidebar ${isMobile ? 'mobile-sidebar' : ''} ${isMobile && isOpen ? 'mobile-sidebar-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-logo">
            <img
              src="/white bg green fill.svg"
              alt="Chain Logo"
              aria-hidden="true"
              onError={(e) => {
                console.error('Failed to load logo:', e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1>{t('common.appName')}</h1>
        </div>
      </div>

      <div className="nav-scroll-area">
        <div className="nav-group">
          {typeof rewardPoints === 'number' && (
            <div className="reward-chip" title="Earn points for sustainable actions">
              <span className="reward-label">Reward Points</span>
              <span className="reward-value">{rewardPoints}</span>
            </div>
          )}

          <div className="nav-actions">
            <NotificationBell
              className="sidebar-bell"
              notifications={notifications}
              unreadCount={notificationUnreadCount}
              isOpen={notificationOpen}
              onToggle={() => setNotificationOpen((open) => !open)}
              onRefresh={onNotificationRefresh}
              onMarkRead={onNotificationMarkRead}
              onMarkAll={onNotificationMarkAll}
            />
            {onOpenChatbot && (
              <button
                className="chatbot-btn-mini"
                onClick={onOpenChatbot}
                title={t('chatbot.title')}
              >
                <Bot size={20} />
              </button>
            )}
          </div>

          <div className="nav-divider" />

          {links.map((link) => {
            const Icon = iconMap[link.key] || LayoutDashboard;
            const isActive = active === link.key;

            return (
              <button
                key={link.key}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavigate(link.key)}
              >
                <div className="nav-item-content">
                  <Icon size={20} className="nav-icon" />
                  <span className="nav-label">{link.label}</span>
                </div>
                {badges?.[link.key] && (
                  <span className="nav-badge">{badges[link.key]}</span>
                )}
                {isActive && <ChevronRight size={16} className="nav-arrow" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-info">
            <div className="user-avatar">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-details">
              <p className="user-name">{userName ?? 'Household'}</p>
              {location && <p className="user-location">{location}</p>}
            </div>
          </div>

          <div className="footer-actions">
            <LanguageSwitcher />
            <button type="button" className="logout-btn" onClick={onLogout} title={t('common.logout')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

