import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastContext';

type Props = {
  conversation: any;
  onClose: () => void;
};

export function ChatOverlay({ conversation, onClose }: Props) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<any[]>(conversation?.messages || []);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = async () => {
    if (!token || !conversation?.id) return;
    try {
      const resp = await api.getMessages(token, conversation.id);
      setMessages(resp.messages || []);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to fetch messages');
    }
  };

  useEffect(() => {
    
    let interval: any;
    let supabaseSub: any = null;
    const setup = async () => {
      loadMessages();
      // try to use supabase realtime if env variables are configured and package exists
      try {
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
          // @ts-ignore - optional dependency
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);
          supabaseSub = supabase
            .channel(`public:messages:conversation_id=eq.${conversation.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, (payload: any) => {
              setMessages((p) => [...p, payload.new]);
            })
            .subscribe();
        } else {
          // fallback to polling
          interval = setInterval(loadMessages, 3000);
        }
      } catch (err) {
        // dynamic import failed or supabase not configured - fallback to polling
        interval = setInterval(loadMessages, 3000);
      }
    };

    setup();
    return () => {
      if (interval) clearInterval(interval);
      if (supabaseSub && typeof supabaseSub.unsubscribe === 'function') supabaseSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, token]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!token || !conversation?.id || !text.trim()) return;
    setSending(true);
    try {
      const resp = await api.sendMessage(token, conversation.id, text.trim());
      if (resp.data) setMessages((p) => [...p, resp.data]);
      setText('');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-overlay">
      <div className="chat-header">
        <strong>Conversation</strong>
        <button className="secondary-update-btn" onClick={onClose}>Close</button>
      </div>
      <div className="chat-messages" ref={messagesRef}>
        {messages.length === 0 && <div className="message-bubble other">No messages yet — say hello!</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: (m.sender?.id || m.sender_id) === user?.id ? 'flex-end' : 'flex-start' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2c5f3f', marginBottom: '0.2rem' }}>{(m.sender && m.sender.full_name) ? ((m.sender.id === user?.id) ? 'You' : m.sender.full_name) : ((m.sender_id === user?.id) ? 'You' : `User ${m.sender_id}`)}</div>
            <div className={`message-bubble ${(m.sender && m.sender.id === user?.id) || m.sender_id === user?.id ? 'me' : 'other'}`}>
              {m.content}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '0.25rem' }}>{new Date(m.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="chat-input-area">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" style={{ flex: 1 }} />
        <button className="chat-send-btn" onClick={handleSend} disabled={sending || !text.trim()}>{sending ? 'Sending...' : 'Send'}</button>
      </div>
    </div>
  );
}

export default ChatOverlay;
