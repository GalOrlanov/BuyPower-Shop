import { useState, useEffect, useRef, useCallback } from 'react';
import { chatAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { X, Send, MessageCircle } from 'lucide-react';

interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'user' | 'business';
  text: string;
  timestamp: string;
}

interface ChatWidgetProps {
  productId: string;
  businessName?: string;
}

export default function ChatWidget({ productId, businessName }: ChatWidgetProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [waitingReply, setWaitingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    if (!user || !productId) return;
    try {
      const res = await chatAPI.getMessages(productId);
      const newMessages: ChatMessage[] = res.data.messages || [];
      setMessages(newMessages);

      // If last message is from user, we're still waiting for a reply
      if (newMessages.length > 0) {
        const last = newMessages[newMessages.length - 1];
        setWaitingReply(last.senderRole === 'user');
      } else {
        setWaitingReply(false);
      }
    } catch {
      // Silently fail on polling errors
    }
  }, [user, productId]);

  // Load messages when chat opens
  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));
    }
  }, [isOpen, user, fetchMessages]);

  // Poll every 10 seconds when chat is open
  useEffect(() => {
    if (isOpen && user) {
      pollIntervalRef.current = setInterval(fetchMessages, 10000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, user, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputText.trim() || sending || !user) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic update
    const optimistic: ChatMessage = {
      _id: `temp_${Date.now()}`,
      conversationId: '',
      senderId: user._id || '',
      senderRole: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setWaitingReply(true);
    scrollToBottom();

    try {
      await chatAPI.sendMessage(productId, text);
      // Refresh to get server-confirmed message
      await fetchMessages();
    } catch {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
      setWaitingReply(false);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50" dir="rtl">
      {/* Chat Panel */}
      {isOpen && (
        <div className="mb-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '460px' }}>

          {/* Header */}
          <div className="bg-[#15803d] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-white" />
              <div>
                <p className="text-white font-semibold text-sm">
                  {businessName ? `שיחה עם ${businessName}` : 'שיחה עם העסק'}
                </p>
                <p className="text-green-200 text-xs">WhatsApp Business</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-green-200 transition bg-transparent border-0 cursor-pointer p-1"
              aria-label="סגור צ'אט"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-[#15803d] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <MessageCircle size={36} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">שלח הודעה לעסק</p>
                <p className="text-xs text-gray-400 mt-1">תשובות יגיעו דרך WhatsApp</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isUser = msg.senderRole === 'user';
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                          isUser
                            ? 'bg-[#15803d] text-white rounded-tl-sm'
                            : 'bg-white text-gray-800 rounded-tr-sm border border-gray-100'
                        }`}
                      >
                        <p className="break-words leading-relaxed">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${isUser ? 'text-green-200' : 'text-gray-400'} text-left`}>
                          {new Date(msg.timestamp).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Waiting indicator */}
                {waitingReply && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm">
                      <p className="text-xs text-gray-400 italic">ממתין לתגובת העסק...</p>
                      <div className="flex gap-1 mt-1">
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleSend}
              disabled={sending || !inputText.trim()}
              className="w-9 h-9 rounded-full bg-[#15803d] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-green-700 transition border-0 cursor-pointer"
              aria-label="שלח"
            >
              <Send size={15} />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="הקלד הודעה..."
              disabled={sending}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-2 text-sm focus:outline-none focus:border-[#15803d] disabled:opacity-50 text-right"
              dir="rtl"
            />
          </div>
        </div>
      )}

      {/* Floating Bubble Button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-14 h-14 rounded-full bg-[#15803d] text-white shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center border-0 cursor-pointer relative"
        aria-label="פתח צ'אט עם העסק"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <>
            <MessageCircle size={26} />
            {/* Unread dot — shown when there are business messages and chat is closed */}
            {messages.some(m => m.senderRole === 'business') && !isOpen && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            )}
          </>
        )}
      </button>
    </div>
  );
}
