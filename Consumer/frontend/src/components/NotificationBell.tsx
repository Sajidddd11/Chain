import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NotificationItem } from '../types';

type NotificationBellProps = {
  notifications: NotificationItem[];
  unreadCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
  onMarkRead?: (id: string) => void;
  onMarkAll?: () => void;
  className?: string;
};

export function NotificationBell({
  notifications,
  unreadCount,
  isOpen,
  onToggle,
  onRefresh,
  onMarkRead,
  onMarkAll,
  className = '',
}: NotificationBellProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (isOpen && onRefresh) {
      onRefresh();
    }
  }, [isOpen, onRefresh]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          // For sidebar bell, position to the right of the sidebar
          const isSidebarBell = className.includes('sidebar-bell');
          setPanelPosition({
            top: rect.bottom + 8,
            left: isSidebarBell ? rect.right + 8 : rect.left,
          });
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      // Close on outside click
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          buttonRef.current &&
          !buttonRef.current.contains(target) &&
          !(target as Element).closest?.('.notification-panel')
        ) {
          onToggle();
        }
      };

      // Use a small delay to avoid closing immediately when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      setPanelPosition(null);
    }
  }, [isOpen, className, onToggle]);

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const panelContent = isOpen && panelPosition ? (
    <div
      className={`notification-panel ${className.includes('sidebar-bell') ? 'sidebar-bell-panel' : ''}`}
      style={{
        position: 'fixed',
        top: `${panelPosition.top}px`,
        left: `${panelPosition.left}px`,
        zIndex: 1001,
      }}
    >
      <div className="notification-panel__header">
        <div className="notification-panel__actions">
          {onRefresh && (
            <button type="button" onClick={onRefresh}>
              Refresh
            </button>
          )}
          {onMarkAll && (
            <button type="button" onClick={onMarkAll}>
              Mark all read
            </button>
          )}
          <button type="button" onClick={onToggle}>
            Close
          </button>
        </div>
      </div>
      <div className="notification-panel__body">
        {notifications.length === 0 ? (
          <p className="notification-empty">No notifications yet.</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item${notification.is_read ? '' : ' notification-item--unread'}`}
            >
              <div className="notification-item__content">
                {notification.body && <p>{notification.body}</p>}
                <small>{formatDate(notification.created_at)}</small>
              </div>
              {!notification.is_read && onMarkRead && (
                <button type="button" onClick={() => onMarkRead(notification.id)}>
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`notification-bell-container ${className}`}>
        <button
          ref={buttonRef}
          className="notification-bell"
          onClick={onToggle}
          aria-label="Notifications"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
      </div>
      {panelContent && createPortal(panelContent, document.body)}
    </>
  );
}

export default NotificationBell;

