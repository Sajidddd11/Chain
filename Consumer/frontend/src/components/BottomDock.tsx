import React, { useState } from 'react';
import {
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
  MoreHorizontal,
  X,
} from 'lucide-react';

type NavLink = {
  label: string;
  key: string;
};

type BottomDockProps = {
  links: NavLink[];
  active: string;
  onNavigate: (key: string) => void;
  badges?: Record<string, number | undefined>;
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

export function BottomDock({
  links,
  active,
  onNavigate,
  badges,
}: BottomDockProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Primary links (first 4)
  const primaryLinks = links.slice(0, 4);
  // Secondary links (rest)
  const secondaryLinks = links.slice(4);

  const handleNavigate = (key: string) => {
    onNavigate(key);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Overlay & Drawer */}
      <div
        className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />

      <div className={`mobile-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-grid">
          {secondaryLinks.map((link) => {
            const Icon = iconMap[link.key] || LayoutDashboard;
            const isActive = active === link.key;

            return (
              <button
                key={link.key}
                className={`mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavigate(link.key)}
              >
                <div className="mobile-menu-icon" style={{
                  background: isActive ? 'var(--green-900)' : 'var(--mint-50)',
                  color: isActive ? 'white' : 'var(--green-800)'
                }}>
                  <Icon size={24} />
                  {badges?.[link.key] && (
                    <span className="dock-badge" style={{ top: -4, right: -4 }}>
                      {badges[link.key]}
                    </span>
                  )}
                </div>
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Dock */}
      <div className="bottom-dock">
        <div className="bottom-dock-container">
          {primaryLinks.map((link) => {
            const Icon = iconMap[link.key] || LayoutDashboard;
            const isActive = active === link.key;

            return (
              <button
                key={link.key}
                className={`bottom-dock-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavigate(link.key)}
              >
                <div className="dock-icon-wrapper">
                  <Icon size={24} className="dock-icon" />
                  {badges?.[link.key] && (
                    <span className="dock-badge">{badges[link.key]}</span>
                  )}
                </div>
                <span className="dock-label">{link.label}</span>
              </button>
            );
          })}

          {/* More Button */}
          <button
            className={`bottom-dock-item ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="dock-icon-wrapper">
              {isMenuOpen ? (
                <X size={24} className="dock-icon" />
              ) : (
                <MoreHorizontal size={24} className="dock-icon" />
              )}
              {/* Show badge on More button if any secondary link has a badge */}
              {secondaryLinks.some(link => badges?.[link.key]) && (
                <span className="dock-badge" style={{ background: '#ef4444' }} />
              )}
            </div>
            <span className="dock-label">{isMenuOpen ? 'Close' : 'More'}</span>
          </button>
        </div>
      </div>
    </>
  );
}
