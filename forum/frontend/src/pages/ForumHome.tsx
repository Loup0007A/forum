import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import styles from './ForumHome.module.css';

interface Forum {
  id: string; name: string; description: string; slug: string;
  _count: { threads: number };
  threads: Array<{ title: string; slug: string; updatedAt: string;
    author: { username: string }; posts: Array<{ author: { username: string } }> }>;
  subForums: Array<{ id: string; name: string; slug: string }>;
}

interface Category {
  id: string; name: string; description: string; icon: string; forums: Forum[];
}

export default function ForumHome() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, threads: 0, online: 0 });

  useEffect(() => {
    // On récupère les catégories qui, côté backend, 
    // doivent inclure (Prisma 'include') leurs forums associés.
    api.get('/forum/categories')
      .then(r => {
        setCategories(r.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur lors de la récupération :", err);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  if (categories.length === 0) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>📋</div>
      <h2>Forum vide</h2>
      <p>Aucune catégorie n'a encore été créée.<br />Connectez-vous en tant qu'admin pour configurer le forum.</p>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Stats bar */}
      <div className={styles.statsBar}>
        {[
          { label: 'Membres', value: stats.users, icon: '👥' },
          { label: 'Sujets', value: stats.threads, icon: '📝' },
          { label: 'Messages', value: stats.posts, icon: '💬' },
          { label: 'En ligne', value: stats.online, icon: '🟢' },
        ].map(s => (
          <div key={s.label} className={styles.stat}>
            <span className={styles.statIcon}>{s.icon}</span>
            <div>
              <div className={styles.statValue}>{s.value.toLocaleString()}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Categories */}
      {categories.map((cat, ci) => (
        <section key={cat.id} className={styles.category} style={{ animationDelay: `${ci * 0.05}s` }}>
          <div className={styles.catHeader}>
            {cat.icon && <span className={styles.catIcon}>{cat.icon}</span>}
            <h2 className={styles.catName}>{cat.name}</h2>
            {cat.description && <p className={styles.catDesc}>{cat.description}</p>}
          </div>

          <div className={styles.forums}>
            {cat.forums.map(forum => {
              const lastThread = forum.threads[0];
              const lastPost = lastThread?.posts?.[0];
              return (
                <div key={forum.id} className={styles.forumRow}>
                  <div className={styles.forumMain}>
                    <div className={styles.forumIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div className={styles.forumInfo}>
                      <Link to={`/forum/${forum.slug}`} className={styles.forumName}>{forum.name}</Link>
                      {forum.description && <p className={styles.forumDesc}>{forum.description}</p>}
                      {forum.subForums?.length > 0 && (
                        <div className={styles.subForums}>
                          {forum.subForums.map(sf => (
                            <Link key={sf.id} to={`/forum/${sf.slug}`} className={styles.subForum}>
                              ↳ {sf.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.forumStats}>
                    <div className={styles.forumStat}>
                      <span className={styles.forumStatNum}>{forum._count.threads}</span>
                      <span className={styles.forumStatLabel}>sujets</span>
                    </div>
                  </div>

                  <div className={styles.lastPost}>
                    {lastThread ? (
                      <>
                        <Link to={`/thread/${lastThread.slug}`} className={styles.lastPostTitle}>
                          {lastThread.title.slice(0, 40)}{lastThread.title.length > 40 ? '…' : ''}
                        </Link>
                        <div className={styles.lastPostMeta}>
                          par <Link to={`/profile/${lastPost?.author?.username || lastThread.author.username}`} className={styles.lastPostAuthor}>
                            {lastPost?.author?.username || lastThread.author.username}
                          </Link>
                          {' · '}
                          {formatDistanceToNow(new Date(lastThread.updatedAt), { addSuffix: true, locale: fr })}
                        </div>
                      </>
                    ) : (
                      <span className={styles.noPost}>Aucun sujet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
