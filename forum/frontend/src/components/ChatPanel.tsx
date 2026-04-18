import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../hooks/useAuth';
import { getSocket } from '../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import styles from './ChatPanel.module.css';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: { username: string; avatarUrl?: string; rank: string; role: string };
}

interface Props { open: boolean; onClose: () => void; }

export default function ChatPanel({ open, onClose }: Props) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_chat', 'general');

    socket.on('chat_history', (msgs: Message[]) => setMessages(msgs));
    socket.on('chat_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on('chat_message_deleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });
    socket.on('user_typing', ({ username: u }: { username: string }) => {
      if (u === user?.username) return;
      setTyping(prev => prev.includes(u) ? prev : [...prev, u]);
    });
    socket.on('user_stopped_typing', ({ userId: uid }: { userId: string }) => {
      setTyping(prev => prev.filter(u => u !== uid));
    });
    socket.on('online_users', (users: any[]) => setOnlineCount(users.length));

    return () => {
      socket.emit('leave_chat', 'general');
      socket.off('chat_history');
      socket.off('chat_message');
      socket.off('chat_message_deleted');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
      socket.off('online_users');
    };
  }, [open, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing_start', { room: 'general' });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { room: 'general' });
    }, 1500);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('chat_message', { content: input.trim(), room: 'general' });
    socket.emit('typing_stop', { room: 'general' });
    setInput('');
    clearTimeout(typingTimer.current);
  }

  function deleteMessage(id: string) {
    const socket = getSocket();
    socket?.emit('admin_delete_message', id);
  }

  if (!open) return null;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.onlineDot} />
          <span className={styles.title}>Chat</span>
          <span className={styles.count}>{onlineCount} en ligne</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <span>💬</span>
            <p>Aucun message. Soyez le premier !</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.msg} ${msg.user.username === user?.username ? styles.msgOwn : ''}`}>
            <div className={styles.msgAvatar}>
              {msg.user.avatarUrl
                ? <img src={msg.user.avatarUrl} alt={msg.user.username} />
                : <span>{msg.user.username[0].toUpperCase()}</span>}
            </div>
            <div className={styles.msgBody}>
              <div className={styles.msgMeta}>
                <span className={`${styles.msgAuthor} ${msg.user.role === 'ADMIN' ? styles.isAdmin : msg.user.role === 'MODERATOR' ? styles.isMod : ''}`}>
                  {msg.user.username}
                </span>
                <span className={styles.msgTime}>
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: fr })}
                </span>
                {user && ['MODERATOR', 'ADMIN'].includes(user.role) && (
                  <button className={styles.delBtn} onClick={() => deleteMessage(msg.id)}>✕</button>
                )}
              </div>
              <div className={styles.msgContent}>{msg.content}</div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing.length > 0 && (
          <div className={styles.typing}>
            <div className={styles.typingDots}>
              <span/><span/><span/>
            </div>
            <span>{typing.join(', ')} {typing.length > 1 ? 'écrivent' : 'écrit'}...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className={styles.inputArea} onSubmit={send}>
        <input
          className={styles.chatInput}
          value={input}
          onChange={handleInput}
          placeholder="Envoyer un message..."
          maxLength={2000}
          autoComplete="off"
        />
        <button type="submit" className={styles.sendBtn} disabled={!input.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
