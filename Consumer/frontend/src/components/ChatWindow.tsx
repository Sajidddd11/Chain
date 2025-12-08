import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastContext';
import { ArrowLeft, Send } from 'lucide-react';

type Props = {
    conversation: any;
    onBack?: () => void;
    className?: string;
};

export function ChatWindow({ conversation, onBack, className = '' }: Props) {
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
            try {
                if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                    // @ts-ignore
                    const { createClient } = await import('@supabase/supabase-js');
                    const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);
                    supabaseSub = supabase
                        .channel(`public:messages:conversation_id=eq.${conversation.id}`)
                        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, (payload: any) => {
                            setMessages((p) => [...p, payload.new]);
                        })
                        .subscribe();
                } else {
                    interval = setInterval(loadMessages, 3000);
                }
            } catch (err) {
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

    const getSenderName = (m: any) => {
        if (m.sender && m.sender.full_name) {
            return m.sender.id === user?.id ? 'You' : m.sender.full_name;
        }
        return m.sender_id === user?.id ? 'You' : `User ${m.sender_id}`;
    };

    const getOtherParticipantName = () => {
        if (!conversation.otherParticipants || conversation.otherParticipants.length === 0) return 'Unknown';
        if (conversation.otherParticipants.length === 1) return conversation.otherParticipants[0].full_name;
        return `${conversation.otherParticipants[0].full_name} +${conversation.otherParticipants.length - 1}`;
    };

    return (
        <div className={`chat-window ${className}`}>
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {onBack && (
                        <button className="back-button" onClick={onBack}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            {conversation.donations?.title || 'Donation Chat'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {getOtherParticipantName()}
                        </div>
                    </div>
                </div>
            </div>

            <div className="chat-messages" ref={messagesRef}>
                {messages.length === 0 && (
                    <div className="empty-chat-state">
                        <p>No messages yet — say hello!</p>
                    </div>
                )}
                {messages.map((m) => (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: (m.sender?.id || m.sender_id) === user?.id ? 'flex-end' : 'flex-start' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
                            {getSenderName(m)}
                        </div>
                        <div className={`message-bubble ${(m.sender && m.sender.id === user?.id) || m.sender_id === user?.id ? 'me' : 'other'}`}>
                            {m.content}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="chat-input-area">
                <input
                    className="chat-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="chat-send-btn" onClick={handleSend} disabled={sending || !text.trim()}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
