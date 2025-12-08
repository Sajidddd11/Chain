import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type MobileHeaderProps = {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  userName?: string;
};

export function MobileHeader({
  isMenuOpen,
  onMenuToggle,
  userName,
}: MobileHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="mobile-header">
      <div className="mobile-header-content">
        <button
          className="mobile-menu-toggle"
          onClick={onMenuToggle}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="mobile-header-brand">
          <div className="mobile-brand-logo">
            <img
              src="/white bg green fill.svg"
              alt="Chain Logo"
              onError={(e) => {
                console.error('Failed to load logo:', e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="mobile-brand-title">{t('common.appName')}</h1>
        </div>

        {userName && (
          <div className="mobile-user-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
