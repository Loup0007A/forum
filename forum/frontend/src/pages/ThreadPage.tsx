import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../hooks/useAuth';
import { getSocket } from '../hooks/useSocket';
import styles from './ThreadPage.module.css';

const EMOJIS = ['👍','❤️','😂','😮','😢','😡','🎉','🔥'];

interface Author {
  id: string; username: string; avatarUrl?: string; rank: string;
  role: string; points: number; signature?: string; createdAt: string;
  _count: { posts: number };
}

interface Post {
  id: string; content: string; createdAt: string; editedAt?: string;
  isBestAnswer: boolean; author: Author;
  reactions: Array<{ emoji: string; user: { username: string } }>;
  attachments: Array<{ id: string; filename: string; url: string }>;
}

interface Thread {
  id: string; title: string; isPinned: boolean; isLocked: boolean;
  views: number; createdAt: string;
  author: Author;
  forum: { name: string; slug: string; category: { name: string } };
  tags: Array<{ id: string; name: string }>;
}

export default function ThreadPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThread(page);
  }, [slug, page]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !thread) return;

    socket.emit('join_thread', thread.id);

    socket.on('new_post', (post: Post) => {
      setPosts(prev => [...prev, post]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    socket.on('post_updated', (updated: Post) => {
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
    });
    socket.on('post_deleted', ({ postId }: { postId: string }) => {
      setPosts(prev => prev.filter(p => p.id !== postId));
    });
    socket.on('user_typing', ({ username: u }: { username: string }) => {
      if (u === user?.username) return;
      setTypingUsers(prev => prev.includes(u) ? prev : [...prev, u]);
    });
    socket.on('user_stopped_typing', ({ userId: uid }: { userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u !== uid));
    });

    return () => {
      socket.emit('leave_thread', thread.id);
      socket.off('new_post'); socket.off('post_updated');
      socket.off('post_deleted'); socket.off('user_typing'); socket.off('user_stopped_typing');
    };
  }, [thread?.id]);

  async function loadThread(p: number) {
    setLoading(true);
    try {
      const { data } = await api.get(`/threads/${slug}?page=${p}`);
      setThread(data.thread); setPosts(data.posts);
      setTotal(data.total); setPages(data.pages);
    } catch { navigate('/forum'); }
    finally { setLoading(false); }
  }

  function handleReplyInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReplyContent(e.target.value);
    const socket = getSocket();
    if (!socket || !thread) return;
    socket.emit('typing_start', { threadId: thread.id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { threadId: thread.id });
    }, 1500);
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim() || !thread) return;
    setSubmitting(true);
    try {
      await api.post('/posts', { content: replyContent, threadId: thread.id });
      setReplyContent('');
      getSocket()?.emit('typing_stop', { threadId: thread.id });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'envoi.');
    } finally { setSubmitting(false); }
  }

  async function react(postId: string, emoji: string) {
    try {
      await api.post(`/posts/${postId}/react`, { emoji });
      loadThread(page);
    } catch {}
  }

  async function deletePost(postId: string) {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      toast.success('Message supprimé.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur.');
    }
  }

  async function saveEdit(postId: string) {
    if (!editContent.trim()) return;
    try {
      await api.patch(`/posts/${postId}`, { content: editContent });
      setEditingId(null);
      toast.success('Message modifié.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur.');
    }
  }

  async function markBest(postId: string) {
    try {
      await api.patch(`/posts/${postId}/best-answer`);
      loadThread(page); toast.success('Meilleure réponse marquée !');
    } catch {}
  }

  async function pinThread() {
    if (!thread) return;
    try {
      await api.patch(`/threads/${thread.id}/pin`);
      loadThread(page);
    } catch {}
  }

  async function closeThread() {
    if (!thread) return;
    try {
      await api.patch(`/threads/${thread.id}/close`);
      loadThread(page);
    } catch {}
  }

  if (loading) return <div className={styles.loading}><span className="spinner" /></div>;
  if (!thread) return null;

  const isMod = user && ['MODERATOR', 'ADMIN'].includes(user.role);
  const isAuthor = (authorId: string) => user?.id === authorId;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link to="/forum">Accueil</Link>
        <span>›</span>
        <Link to={`/forum/${thread.forum.slug}`}>{thread.forum.category.name}</Link>
        <span>›</span>
        <Link to={`/forum/${thread.forum.slug}`}>{thread.forum.name}</Link>
        <span>›</span>
        <span className={styles.breadcrumbCurrent}>{thread.title}</span>
      </div>

      {/* Thread header */}
      <div className={styles.threadHeader}>
        <div className={styles.threadMeta}>
          {thread.isPinned && <span className="badge badge-pinned">📌 Épinglé</span>}
          {thread.isLocked && <span className="badge badge-locked">🔒 Verrouillé</span>}
          {thread.tags.map(t => (
            <span key={t.id} className={styles.tag}>{t.name}</span>
          ))}
        </div>
        <h1 className={styles.threadTitle}>{thread.title}</h1>
        <div className={styles.threadInfo}>
          <span>par <Link to={`/profile/${thread.author.username}`} className={styles.authorLink}>{thread.author.username}</Link></span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true, locale: fr })}</span>
          <span>·</span>
          <span>{thread.views} vues</span>
          <span>·</span>
          <span>{total} message{total > 1 ? 's' : ''}</span>
        </div>

        {/* Mod actions */}
        {isMod && (
          <div className={styles.modActions}>
            <button className="btn btn-ghost btn-sm" onClick={pinThread}>
              {thread.isPinned ? '📌 Désépingler' : '📌 Épingler'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={closeThread}>
              {thread.isLocked ? '🔓 Ouvrir' : '🔒 Verrouiller'}
            </button>
          </div>
        )}
      </div>

      {/* Posts */}
      <div className={styles.posts}>
        {posts.map((post, i) => (
          <div key={post.id} className={`${styles.post} ${post.isBestAnswer ? styles.postBest : ''}`} id={`post-${post.id}`}>
            {post.isBestAnswer && (
              <div className={styles.bestAnswerBanner}>✅ Meilleure réponse</div>
            )}

            {/* Author sidebar */}
            <div className={styles.postAuthor}>
              <Link to={`/profile/${post.author.username}`}>
                <div className={styles.avatar}>
                  {post.author.avatarUrl
                    ? <img src={post.author.avatarUrl} alt={post.author.username} />
                    : <span>{post.author.username[0].toUpperCase()}</span>}
                </div>
              </Link>
              <Link to={`/profile/${post.author.username}`} className={styles.authorName}>
                {post.author.username}
              </Link>
              <span className={`${styles.authorRank} rank-${post.author.rank.toLowerCase()}`}>
                {post.author.rank}
              </span>
              {post.author.role !== 'USER' && (
                <span className={`badge ${post.author.role === 'ADMIN' ? 'badge-admin' : 'badge-mod'}`}>
                  {post.author.role === 'ADMIN' ? 'Admin' : 'Modo'}
                </span>
              )}
              <div className={styles.authorStats}>
                <span>{post.author._count.posts} msg</span>
                <span>{post.author.points} pts</span>
              </div>
            </div>

            {/* Post body */}
            <div className={styles.postBody}>
              <div className={styles.postTop}>
                <span className={styles.postDate}>
                  #{i + 1} · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}
                  {post.editedAt && <span className={styles.edited}> (modifié)</span>}
                </span>
                <div className={styles.postActions}>
                  {(isAuthor(post.author.id) || isMod) && (
                    <button className={styles.actionBtn} onClick={() => {
                      setEditingId(post.id); setEditContent(post.content);
                    }}>✏️</button>
                  )}
                  {(isAuthor(post.author.id) || isMod) && (
                    <button className={styles.actionBtn} onClick={() => deletePost(post.id)}>🗑️</button>
                  )}
                  {isAuthor(thread.author.id) && i > 0 && (
                    <button className={styles.actionBtn} onClick={() => markBest(post.id)} title="Meilleure réponse">⭐</button>
                  )}
                </div>
              </div>

              {editingId === post.id ? (
                <div className={styles.editArea}>
                  <textarea className={styles.editInput} value={editContent}
                    onChange={e => setEditContent(e.target.value)} rows={6} />
                  <div className={styles.editBtns}>
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(post.id)}>Sauvegarder</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <div className={styles.postContent}
                  dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>') }} />
              )}

              {/* Attachments */}
              {post.attachments.length > 0 && (
                <div className={styles.attachments}>
                  {post.attachments.map(a => (
                    <a key={a.id} href={a.url} className={styles.attachment} target="_blank" rel="noopener noreferrer">
                      📎 {a.filename}
                    </a>
                  ))}
                </div>
              )}

              {/* Signature */}
              {post.author.signature && (
                <div className={styles.signature}>{post.author.signature}</div>
              )}

              {/* Reactions */}
              <div className={styles.reactions}>
                <div className={styles.reactionBtns}>
                  {EMOJIS.map(emoji => {
                    const count = post.reactions.filter(r => r.emoji === emoji).length;
                    const reacted = post.reactions.some(r => r.emoji === emoji && r.user.username === user?.username);
                    if (count === 0 && !reacted) return null;
                    return (
                      <button key={emoji}
                        className={`${styles.reactionBtn} ${reacted ? styles.reactionActive : ''}`}
                        onClick={() => react(post.id, emoji)}>
                        {emoji} {count}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.addReaction}>
                  {EMOJIS.map(emoji => (
                    <button key={emoji} className={styles.emojiPicker} onClick={() => react(post.id, emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className={styles.typing}>
            <div className={styles.typingDots}><span/><span/><span/></div>
            <span>{typingUsers.join(', ')} {typingUsers.length > 1 ? 'écrivent' : 'écrit'}...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} className={`${styles.pageBtn} ${page === i+1 ? styles.pageBtnActive : ''}`}
              onClick={() => setPage(i+1)}>{i+1}</button>
          ))}
        </div>
      )}

      {/* Reply box */}
      {!thread.isLocked || isMod ? (
        <div className={styles.replyBox}>
          <h3 className={styles.replyTitle}>Répondre</h3>
          {thread.isLocked && <p className={styles.lockedNote}>⚠️ Ce sujet est verrouillé — réponse réservée aux modérateurs</p>}
          <form onSubmit={submitReply}>
            <textarea
              className={styles.replyInput}
              value={replyContent}
              onChange={handleReplyInput}
              placeholder="Écrivez votre réponse..."
              rows={6}
              maxLength={50000}
            />
            <div className={styles.replyActions}>
              <span className={styles.charCount}>{replyContent.length} / 50 000</span>
              <button type="submit" className="btn btn-primary" disabled={!replyContent.trim() || submitting}>
                {submitting ? 'Envoi...' : 'Envoyer la réponse →'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.lockedBanner}>🔒 Ce sujet est verrouillé — les réponses sont désactivées.</div>
      )}
    </div>
  );
}
