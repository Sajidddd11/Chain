import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useToast } from './ToastContext';
import { X, Send, Bot, User, Trash2, Image as ImageIcon, Loader2, Mic, MicOff, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  image?: string;
};

const STORAGE_KEY = 'nourishbot_messages';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function NourishBot({ isOpen, onClose }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // If in voice mode and not speaking, restart listening (unless manually stopped)
        // Note: We handle auto-restart in the handleSend/speak logic to avoid loops
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          // Auto-send in voice mode
          handleSend(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showToast('error', 'Microphone access denied');
          setIsVoiceMode(false);
        }
      };
    }
  }, []);

  // Load messages from server when chat opens
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchHistory = async () => {
      try {
        const { messages: history } = await api.getChatbotHistory(token);
        if (history && history.length > 0) {
          // Map backend messages to frontend format
          const formattedMessages: ChatMessage[] = history.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            created_at: msg.created_at,
            // Backend doesn't store image URL in a separate column yet, so we skip it for history
          }));
          setMessages(formattedMessages);
        } else {
          // Fallback to local storage if server history is empty (migration phase)
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            setMessages(JSON.parse(saved));
          }
        }
      } catch (error) {
        console.error('Failed to fetch chat history:', error);
        // Fallback to local storage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setMessages(JSON.parse(saved));
        }
      }
    };

    fetchHistory();
  }, [isOpen, token]);

  // Save messages to localStorage as backup
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Failed to save messages to localStorage:', error);
      }
    }
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, isListening]);

  // Handle Voice Mode Toggle
  const toggleVoiceMode = () => {
    if (!recognitionRef.current) {
      showToast('error', 'Speech recognition not supported in this browser');
      return;
    }

    if (isVoiceMode) {
      setIsVoiceMode(false);
      recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    } else {
      setIsVoiceMode(true);
      recognitionRef.current.start();
    }
  };

  const speakResponse = (text: string) => {
    if (!isVoiceMode) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Strip markdown for speech
    const plainText = text.replace(new RegExp('[#*\\x60_]', 'g'), '');
    utterance.text = plainText;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Resume listening after speaking
      if (isVoiceMode && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore if already started
        }
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showToast('error', 'Image size must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!token || (!textToSend.trim() && !selectedImage) || sending) return;

    const userMessage = textToSend.trim();
    const imageToSend = selectedImage;

    setInput('');
    setSelectedImage(null);
    setSending(true);

    // Stop listening while processing
    if (isVoiceMode && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      image: imageToSend || undefined,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Send message with current conversation history (last 20 messages)
      const history = messages.slice(-20).map(msg => ({
        role: msg.role,
        content: msg.content,
        image: msg.image
      }));

      const response = await api.sendChatbotMessage(token, userMessage, history, imageToSend || undefined);

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Speak response if in voice mode
      if (isVoiceMode) {
        speakResponse(response.response);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      showToast('error', error?.message || 'Failed to send message');
      // Remove user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    if (!confirm('Are you sure you want to clear the conversation history?')) return;

    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
    showToast('success', 'Conversation cleared');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '800px',
          height: '90vh',
          maxHeight: '700px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1f7a4d 0%, #2c5f3f 100%)',
            color: 'white',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>NourishBot</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                Your AI food sustainability assistant
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={toggleVoiceMode}
              style={{
                background: isVoiceMode ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                animation: isListening ? 'pulse 1.5s infinite' : 'none',
              }}
              title={isVoiceMode ? 'Disable Voice Mode' : 'Enable Voice Mode'}
            >
              {isVoiceMode ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={handleClear}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              title="Clear conversation"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            background: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #1f7a4d, #2c5f3f)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={40} color="white" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.2rem' }}>
                  Welcome to NourishBot!
                </h3>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6' }}>
                  I can help you with food waste reduction, nutrition balancing, budget meal planning, and more.
                  <br />
                  Ask me anything about your food sustainability journey!
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  justifyContent: 'center',
                  marginTop: '1rem',
                }}
              >
                {[
                  'How can I reduce food waste?',
                  'Suggest budget-friendly meals',
                  'What should I cook with my inventory?',
                  'Help with nutrition planning',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    style={{
                      background: 'white',
                      border: '2px solid #1f7a4d',
                      borderRadius: '20px',
                      padding: '0.5rem 1rem',
                      color: '#1f7a4d',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = '#1f7a4d';
                      (e.target as HTMLElement).style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = 'white';
                      (e.target as HTMLElement).style.color = '#1f7a4d';
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background:
                        message.role === 'user'
                          ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                          : 'linear-gradient(135deg, #1f7a4d, #2c5f3f)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {message.role === 'user' ? (
                      <User size={18} color="white" />
                    ) : (
                      <Bot size={18} color="white" />
                    )}
                  </div>
                  <div
                    style={{
                      maxWidth: '75%',
                      background: message.role === 'user' ? '#3b82f6' : 'white',
                      color: message.role === 'user' ? 'white' : '#1e293b',
                      padding: '0.875rem 1.125rem',
                      borderRadius: '16px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      lineHeight: '1.5',
                      fontSize: '0.95rem',
                    }}
                  >
                    {message.image && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <img
                          src={message.image}
                          alt="Uploaded content"
                          style={{
                            maxWidth: '100%',
                            borderRadius: '8px',
                            maxHeight: '200px',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    )}
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        marginTop: '0.5rem',
                        color: message.role === 'user' ? 'rgba(255, 255, 255, 0.8)' : '#64748b',
                      }}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1f7a4d, #2c5f3f)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={18} color="white" />
                  </div>
                  <div
                    style={{
                      background: 'white',
                      padding: '0.875rem 1.125rem',
                      borderRadius: '16px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: '1.5rem',
            background: 'white',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {isVoiceMode && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              background: '#f0fdf4',
              borderRadius: '8px',
              color: '#166534',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              {isListening ? (
                <>
                  <div className="recording-dot" />
                  Listening... Speak now
                </>
              ) : isSpeaking ? (
                <>
                  <Volume2 size={16} className="animate-pulse" />
                  Speaking...
                </>
              ) : (
                'Voice Mode Active'
              )}
            </div>
          )}

          {selectedImage && (
            <div style={{
              position: 'relative',
              width: 'fit-content',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <img
                src={selectedImage}
                alt="Selected"
                style={{
                  height: '80px',
                  borderRadius: '4px',
                  display: 'block'
                }}
              />
              <button
                onClick={() => setSelectedImage(null)}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '12px',
                padding: '0.875rem',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              title="Upload image"
            >
              <ImageIcon size={20} />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isVoiceMode ? "Listening..." : "Ask NourishBot anything about food sustainability..."}
              disabled={sending}
              style={{
                flex: 1,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#1f7a4d';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !selectedImage) || sending}
              style={{
                background: (input.trim() || selectedImage) && !sending ? 'linear-gradient(135deg, #1f7a4d, #2c5f3f)' : '#cbd5e1',
                border: 'none',
                borderRadius: '12px',
                padding: '0.875rem 1.25rem',
                color: 'white',
                cursor: (input.trim() || selectedImage) && !sending ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if ((input.trim() || selectedImage) && !sending) {
                  (e.target as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(31, 122, 77, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(0)';
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .recording-dot {
          width: 10px;
          height: 10px;
          background-color: #ef4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 0;
        }
        
        .typing-indicator span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #64748b;
          display: inline-block;
          animation: typing-bounce 1.4s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0;
        }
        
        @keyframes typing-bounce {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Markdown Styles */
        .markdown-content p {
          margin: 0 0 0.5rem 0;
        }
        .markdown-content p:last-child {
          margin: 0;
        }
        .markdown-content ul, .markdown-content ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        .markdown-content li {
          margin-bottom: 0.25rem;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          margin: 0.5rem 0;
          font-size: 1.1em;
          font-weight: 700;
        }
        .markdown-content strong {
          font-weight: 600;
        }
        .markdown-content code {
          background: rgba(0,0,0,0.1);
          padding: 0.1rem 0.3rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
}

export default NourishBot;
