import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../hooks/useAuth';
import { getSocket } from '../hooks/useSocket';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: { username: string; avatarUrl?: string };
}

interface Conversation {
  id: string;
  username: string;
  avatarUrl?: string;
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [showNew, setShowNew] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/users/me/conversations').then(r => setConversations(r.data));
  }, []);

  useEffect(() => {
    const withId = searchParams.get('with');
    if (withId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === withId);
      if (conv) selectConversation(conv);
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('private_message', (msg: Message) => {
      if (selectedUser && (msg.senderId === selectedUser.id)) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });
    return () => { socket.off('private_message'); };
  }, [selectedUser]);

  async function selectConversation(conv: Conversation) {
    setSelectedUser(conv);
    const { data } = await api.get(`/users/me/messages/${conv.id}`);
    setMessages(data);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedUser) return;
    setSending(true);
    try {
      const { data } = await api.post('/users/me/messages', { receiverId: selectedUser.id, content: input.trim() });
      setMessages(prev => [...prev, data]);
      setInput('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur.');
    } finally { setSending(false); }
  }

  async function startNewConversation() {
    if (!newUsername.trim()) return;
    try {
      const { data } = await api.get(`/users/${newUsername.trim()}`);
      const conv = { id: data.id, username: data.username, avatarUrl: data.avatarUrl };
      if (!conversations.find(c => c.id === conv.id)) {
        setConversations(prev => [conv, ...prev]);
      }
      selectConversation(conv);
      setShowNew(false);
      setNewUsername('');
    } catch {
      toast.error('Utilisateur introuvable.');
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px - 48px)', gap: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)' }}>Messages</span>
          <button onClick={() => setShowNew(!showNew)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>+ Nouveau</button>
        </div>

        {showNew && (
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)}
              placeholder="Pseudo..." style={{ fontSize: 12, padding: '8px 12px' }}
              onKeyDown={e => e.key === 'Enter' && startNewConversation()} />
            <button onClick={startNewConversation} className="btn btn-primary btn-sm">→</button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
              Aucune conversation
            </div>
          )}
          {conversations.map(conv => (
            <div key={conv.id}
              onClick={() => selectConversation(conv)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
                background: selectedUser?.id === conv.id ? 'var(--bg-3)' : 'transparent',
                borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
              }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fff', fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                {conv.avatarUrl ? <img src={conv.avatarUrl} alt={conv.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : conv.username[0].toUpperCase()}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>{conv.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedUser ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-2)' }}>
            <span style={{ fontSize: 40 }}>✉️</span>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fff', fontSize: 13 }}>
                {selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} alt={selectedUser.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : selectedUser.username[0].toUpperCase()}
              </div>
              <Link to={`/profile/${selectedUser.username}`} style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-0)', textDecoration: 'none' }}>
                {selectedUser.username}
              </Link>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(msg => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        padding: '10px 14px',
                        background: isMe ? 'var(--accent)' : 'var(--bg-3)',
                        border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        fontFamily: 'var(--font-mono)', fontSize: 13, color: isMe ? '#fff' : 'var(--text-0)',
                        lineHeight: 1.6, wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: fr })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Écrire à ${selectedUser.username}...`}
                maxLength={5000}
                style={{ fontSize: 13, padding: '10px 14px' }}
              />
              <button type="submit" className="btn btn-primary" disabled={!input.trim() || sending} style={{ flexShrink: 0 }}>
                {sending ? '...' : '→'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
