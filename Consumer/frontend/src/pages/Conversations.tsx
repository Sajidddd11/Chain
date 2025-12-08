import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useToast } from '../components/ToastContext';
import ChatOverlay from '../components/ChatOverlay';
import type { Conversation } from '../types';

export function Conversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();

  const load = async () => {
    if (!token) {
      console.log('No token available');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      console.log('Fetching conversations...');
      const resp = await api.getConversations(token);
      console.log('Conversations response:', resp);
      setConversations(resp.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations', err);
      showToast('error', 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getParticipantNames = (participants?: Array<{ id: string; full_name: string }>) => {
    if (!participants || participants.length === 0) return 'Unknown';
    if (participants.length === 1) return participants[0].full_name;
    if (participants.length === 2) return participants.map(p => p.full_name).join(' and ');
    return `${participants[0].full_name} and ${participants.length - 1} others`;
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2>Conversations</h2>
          <span>Chat with donors and coordinators for pick up</span>
        </div>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Loading conversations...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Messages</h2>
        <span>Chat with donors and coordinators for pick up</span>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Your conversations</h3>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>📭</div>
            <div>No conversations yet</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Start a conversation by requesting a donation
            </div>
          </div>
        ) : (
          <div>
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="conversation-item"
                onClick={() => setActiveConversation(conversation)}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(31,122,77,0.1)',
                  marginBottom: '0.75rem',
                  cursor: 'pointer',
                  backgroundColor: (conversation.unreadCount || 0) > 0 ? 'rgba(31,122,77,0.02)' : 'white',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(31,122,77,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {(conversation.unreadCount || 0) > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: '#1f7a4d',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {(conversation.unreadCount || 0) > 9 ? '9+' : conversation.unreadCount}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem', color: '#1f7a4d' }}>
                      {conversation.donations?.title || `Donation ${conversation.donation_id?.slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                      {getParticipantNames(conversation.otherParticipants)}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    {formatTime(conversation.lastActivity)}
                  </div>
                </div>

                {conversation.messagePreview && (
                  <div style={{ fontSize: '0.9rem', color: '#555', lineHeight: '1.4' }}>
                    <span style={{ fontWeight: 500, color: '#1f7a4d' }}>
                      {conversation.messagePreview.sender.full_name}:
                    </span>
                    {' '}
                    {conversation.messagePreview.content}
                  </div>
                )}

                {!conversation.messagePreview && (
                  <div style={{ fontSize: '0.9rem', color: '#999', fontStyle: 'italic' }}>
                    No messages yet
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeConversation && (
        <ChatOverlay
          conversation={activeConversation}
          onClose={() => {
            setActiveConversation(null);
            // Refresh conversations to update read status
            load();
          }}
        />
      )}
    </div>
  );
}

export default Conversations;
