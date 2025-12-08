import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface MessagingIconProps {
  onClick: () => void;
}

export function MessagingIcon({ onClick }: MessagingIconProps) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchUnreadCount = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await api.getConversations(token);
      const conversations = response.conversations || [];

      // Count conversations with unread messages
      // For now, we'll count all conversations as "unread" if they have messages
      // In a real app, you'd track read/unread status per message
      const unreadConversations = conversations.filter((conv: any) =>
        conv.messages && conv.messages.length > 0
      );

      setUnreadCount(unreadConversations.length);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      // Poll for new messages every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  if (!hasFetched || unreadCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="messaging-icon-btn"
      title="Messages"
      aria-label={`Messages ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="messaging-icon"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      {unreadCount > 0 && (
        <span className="unread-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {loading && (
        <div className="messaging-loading">
          <div className="loading-dot"></div>
        </div>
      )}
    </button>
  );
}