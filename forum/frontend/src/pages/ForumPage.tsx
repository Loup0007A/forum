// ForumPage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import { useAuthStore } from '../hooks/useAuth';

export default function ForumPage() {
  const { slug } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    api.get(`/forum/${slug}?page=${page}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => navigate('/forum'));
  }, [slug, page]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:80}}><div className="spinner" /></div>;
  if (!data) return null;
  const { forum, threads, total, pages } = data;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Breadcrumb */}
      <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-2)'}}>
        <Link to="/forum" style={{color:'var(--text-2)',textDecoration:'none'}}>Accueil</Link>
        <span>›</span>
        <span style={{color:'var(--text-0)'}}>{forum.name}</span>
      </div>

      {/* Forum header */}
      <div style={{background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:24,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:'var(--text-0)',marginBottom:6}}>{forum.name}</h1>
          {forum.description && <p style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-2)'}}>{forum.description}</p>}
        </div>
        <Link to={`/new-thread/${forum.id}`} className="btn btn-primary">+ Nouveau sujet</Link>
      </div>

      {/* Threads list */}
      <div style={{background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
        {threads.length === 0 && (
          <div style={{padding:60,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-2)'}}>
            Aucun sujet. Soyez le premier à créer un sujet !
          </div>
        )}
        {threads.map((t: any) => (
          <div key={t.id} style={{display:'grid',gridTemplateColumns:'1fr 80px 180px',alignItems:'center',gap:16,padding:'14px 20px',borderBottom:'1px solid var(--border)',transition:'background 0.15s'}}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg-2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
            <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{fontSize:20,marginTop:2}}>{t.isLocked ? '🔒' : t.isPinned ? '📌' : '💬'}</div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  {t.isPinned && <span className="badge badge-pinned">Épinglé</span>}
                  {t.isLocked && <span className="badge badge-locked">Fermé</span>}
                  {t.tags?.map((tag: any) => <span key={tag.id} style={{padding:'1px 8px',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:100,fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-2)'}}>{tag.name}</span>)}
                </div>
                <Link to={`/thread/${t.slug}`} style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:700,color:'var(--text-0)',textDecoration:'none'}}>
                  {t.title}
                </Link>
                <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)',marginTop:3}}>
                  par <Link to={`/profile/${t.author.username}`} style={{color:'var(--accent-h)',textDecoration:'none'}}>{t.author.username}</Link>
                  {' · '}{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true, locale: fr })}
                </div>
              </div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'var(--text-0)'}}>{t._count.posts}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)'}}>réponses</div>
            </div>
            <div>
              {t.posts?.[0] && (
                <>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)',marginBottom:2}}>
                    dernier: <Link to={`/profile/${t.posts[0].author.username}`} style={{color:'var(--accent-h)',textDecoration:'none'}}>{t.posts[0].author.username}</Link>
                  </div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>
                    {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true, locale: fr })}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{display:'flex',gap:6}}>
          {Array.from({length: pages}, (_,i) => (
            <button key={i} onClick={() => setPage(i+1)}
              style={{width:32,height:32,borderRadius:'var(--radius-md)',background:page===i+1?'var(--accent)':'var(--bg-2)',border:`1px solid ${page===i+1?'var(--accent)':'var(--border)'}`,fontFamily:'var(--font-mono)',fontSize:13,color:page===i+1?'#fff':'var(--text-1)',cursor:'pointer'}}>
              {i+1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
