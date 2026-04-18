import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [author, setAuthor] = useState(searchParams.get('author') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) { setQ(query); doSearch(query, author, from, to, 1); }
  }, [searchParams]);

  async function doSearch(qv = q, av = author, fv = from, tv = to, p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qv) params.set('q', qv);
      if (av) params.set('author', av);
      if (fv) params.set('from', fv);
      if (tv) params.set('to', tv);
      params.set('page', String(p));
      const { data } = await api.get(`/threads/search?${params}`);
      setResults(data.threads);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } finally { setLoading(false); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchParams({ q, author, from, to });
    doSearch(q, author, from, to, 1);
  }

  const card = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search form */}
      <div style={card}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-0)', marginBottom: 20 }}>Recherche</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Mots-clés</label>
              <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher dans les sujets et messages..." />
            </div>
            <div className="form-group">
              <label className="form-label">Auteur</label>
              <input className="input" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Pseudo de l'auteur" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Du</label>
              <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Au</label>
              <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 44 }}>
              {loading ? 'Recherche...' : '🔍 Rechercher'}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {(results.length > 0 || loading) && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>
              {total} résultat{total > 1 ? 's' : ''} {q && `pour "${q}"`}
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {results.map((t, i) => (
                <div key={t.id} style={{
                  padding: '16px 0', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {t.isPinned && <span className="badge badge-pinned">📌</span>}
                    {t.isLocked && <span className="badge badge-locked">🔒</span>}
                    {t.tags?.map((tag: any) => (
                      <span key={tag.id} style={{ padding: '1px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 100, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>{tag.name}</span>
                    ))}
                  </div>
                  <Link to={`/thread/${t.slug}`} style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)', textDecoration: 'none' }}>
                    {t.title}
                  </Link>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                    <span>par <Link to={`/profile/${t.author.username}`} style={{ color: 'var(--accent-h)', textDecoration: 'none' }}>{t.author.username}</Link></span>
                    <span>·</span>
                    <span>dans <Link to={`/forum/${t.forum.slug}`} style={{ color: 'var(--text-1)', textDecoration: 'none' }}>{t.forum.name}</Link></span>
                    <span>·</span>
                    <span>{t._count.posts} réponses</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true, locale: fr })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} onClick={() => doSearch(q, author, from, to, i + 1)}
                  style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: page === i + 1 ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${page === i + 1 ? 'var(--accent)' : 'var(--border)'}`, fontFamily: 'var(--font-mono)', fontSize: 13, color: page === i + 1 ? '#fff' : 'var(--text-1)', cursor: 'pointer' }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {results.length === 0 && !loading && q && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-2)' }}>Aucun résultat pour "{q}"</p>
        </div>
      )}
    </div>
  );
}
