import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import { useAuthStore } from '../hooks/useAuth';

// ─── SHARED ────────────────────────────────────────────────────────────

const card = {
  background: 'var(--bg-1)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 24,
};

// ─── DASHBOARD ─────────────────────────────────────────────────────────

function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  const statCards = [
    { label: 'Membres actifs', val: stats.activeUsers, sub: `${stats.totalUsers} total`, color: 'var(--green)', icon: '👥' },
    { label: 'En attente', val: stats.pendingUsers, sub: 'Validation requise', color: 'var(--yellow)', icon: '⏳' },
    { label: 'En ligne', val: stats.onlineUsers, sub: '15 dernières minutes', color: 'var(--cyan)', icon: '🟢' },
    { label: 'Sujets', val: stats.totalThreads, sub: 'Total créés', color: 'var(--accent-h)', icon: '📝' },
    { label: 'Messages', val: stats.totalPosts, sub: `${stats.postsToday} aujourd'hui`, color: 'var(--blue)', icon: '💬' },
    { label: 'Bans actifs', val: stats.totalBans, sub: 'IP + comptes', color: 'var(--red)', icon: '🚫' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>Vue d'ensemble</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val.toLocaleString()}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Top countries */}
      {stats.usersByCountry?.length > 0 && (
        <div style={card}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)', marginBottom: 16 }}>Pays des utilisateurs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.usersByCountry.slice(0, 8).map((c: any) => (
              <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-1)', width: 100, flexShrink: 0 }}>{c.country || 'Unknown'}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${Math.min(100, (c._count / stats.totalUsers) * 100)}%`, transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', width: 30, textAlign: 'right' }}>{c._count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent logs */}
      {stats.recentLogs?.length > 0 && (
        <div style={card}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)', marginBottom: 16 }}>Activité récente</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {stats.recentLogs.slice(0, 10).map((log: any, i: number) => (
              <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 140px', gap: 12, padding: '10px 0', borderBottom: i < 9 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{log.action}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{log.ipAddress}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{log.country} · {log.browser}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── USERS ─────────────────────────────────────────────────────────────

function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('24');
  const [banningId, setBanningId] = useState<string | null>(null);

  async function load(p = page, s = search, st = status) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (s) params.set('search', s);
    if (st) params.set('status', st);
    const { data } = await api.get(`/admin/users?${params}`);
    setUsers(data.users); setTotal(data.total); setPages(data.pages);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function validate(userId: string) {
    await api.post(`/admin/users/${userId}/validate`);
    toast.success('Compte validé !');
    load();
  }

  async function ban(userId: string) {
    if (!banReason.trim()) { toast.error('Raison requise.'); return; }
    await api.post(`/admin/users/${userId}/ban`, { reason: banReason, duration: banDuration });
    toast.success('Utilisateur banni.');
    setBanningId(null); setBanReason(''); load();
  }

  async function unban(userId: string) {
    await api.post(`/admin/users/${userId}/unban`);
    toast.success('Utilisateur débanni.');
    load();
  }

  async function promote(userId: string, role: string) {
    await api.patch(`/admin/users/${userId}/role`, { role });
    toast.success(`Rôle mis à jour.`);
    load();
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'var(--green)', PENDING: 'var(--yellow)', BANNED: 'var(--red)', SUSPENDED: 'var(--yellow)',
  };
  const roleColors: Record<string, string> = {
    ADMIN: 'var(--accent-h)', MODERATOR: 'var(--blue)', USER: 'var(--text-2)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Rechercher</label>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pseudo ou email..." onKeyDown={e => e.key === 'Enter' && load(1, search, status)} />
        </div>
        <div className="form-group">
          <label className="form-label">Statut</label>
          <select className="input" value={status} onChange={e => { setStatus(e.target.value); load(1, search, e.target.value); }} style={{ width: 160 }}>
            <option value="">Tous</option>
            <option value="PENDING">En attente</option>
            <option value="ACTIVE">Actifs</option>
            <option value="BANNED">Bannis</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => load(1, search, status)}>Filtrer</button>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>{total} utilisateur{total > 1 ? 's' : ''}</span>
        </div>

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div> : (
          users.map((u, i) => (
            <div key={u.id}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px auto', gap: 16, padding: '14px 20px', alignItems: 'center', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>{u.username}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: roleColors[u.role] }}>{u.role}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{u.email}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: statusColors[u.status] || 'var(--text-2)' }}>{u.status}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                  {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: fr })}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>{u._count.posts} msg</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {u.status === 'PENDING' && (
                    <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)', color: 'var(--green)' }} onClick={() => validate(u.id)}>✓ Valider</button>
                  )}
                  {u.status === 'BANNED' ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => unban(u.id)}>Débannir</button>
                  ) : u.status !== 'PENDING' && (
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', color: 'var(--red)' }} onClick={() => setBanningId(u.id)}>Bannir</button>
                  )}
                  <select style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
                    value={u.role} onChange={e => promote(u.id, e.target.value)}>
                    <option value="USER">User</option>
                    <option value="MODERATOR">Modo</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              {/* Ban form */}
              {banningId === u.id && (
                <div style={{ padding: '12px 20px 16px', background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label">Raison du ban</label>
                    <input className="input" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Raison..." style={{ fontSize: 12 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Durée (h)</label>
                    <select className="input" value={banDuration} onChange={e => setBanDuration(e.target.value)} style={{ width: 100 }}>
                      <option value="1">1h</option>
                      <option value="24">24h</option>
                      <option value="72">3 jours</option>
                      <option value="168">7 jours</option>
                      <option value="720">30 jours</option>
                    </select>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => ban(u.id)}>Confirmer le ban</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setBanningId(null); setBanReason(''); }}>Annuler</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => { setPage(i + 1); load(i + 1); }}
              style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: page === i + 1 ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${page === i + 1 ? 'var(--accent)' : 'var(--border)'}`, fontFamily: 'var(--font-mono)', fontSize: 13, color: page === i + 1 ? '#fff' : 'var(--text-1)', cursor: 'pointer' }}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ───────────────────────────────────────────────────────────

function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    api.get(`/admin/reports?resolved=${resolved}`).then(r => setReports(r.data));
  }, [resolved]);

  async function resolve(id: string) {
    await api.patch(`/admin/reports/${id}/resolve`);
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success('Signalement résolu.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`btn btn-sm ${!resolved ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setResolved(false)}>En attente</button>
        <button className={`btn btn-sm ${resolved ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setResolved(true)}>Résolus</button>
      </div>

      {reports.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>Aucun signalement {resolved ? 'résolu' : 'en attente'}</p>
        </div>
      ) : (
        reports.map(r => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>{r.reason}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                    par {r.reporter?.username} · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: fr })}
                  </span>
                </div>
                {r.description && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)', marginBottom: 8 }}>{r.description}</p>}
                {r.post && (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-1)', maxHeight: 80, overflow: 'hidden' }}>
                    {r.post.content.slice(0, 200)}{r.post.content.length > 200 ? '...' : ''}
                  </div>
                )}
                {r.thread && (
                  <Link to={`/thread/${r.thread.slug}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-h)', display: 'block', marginTop: 6 }}>
                    → {r.thread.title}
                  </Link>
                )}
              </div>
              {!resolved && (
                <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)', color: 'var(--green)', flexShrink: 0 }} onClick={() => resolve(r.id)}>
                  ✓ Résoudre
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── BANS ──────────────────────────────────────────────────────────────

function Bans() {
  const [bans, setBans] = useState<any[]>([]);

  useEffect(() => {
    api.get('/admin/bans').then(r => setBans(r.data));
  }, []);

  async function removeBan(id: string) {
    await api.delete(`/admin/bans/${id}`);
    setBans(prev => prev.filter(b => b.id !== id));
    toast.success('Bannissement supprimé.');
  }

  const typeColors: Record<string, string> = { IP: 'var(--red)', FINGERPRINT: 'var(--yellow)', USER: 'var(--accent-h)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)', marginBottom: 16 }}>Bannissements actifs ({bans.length})</h3>
        {bans.length === 0 && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)', textAlign: 'center', padding: '20px 0' }}>Aucun bannissement actif.</p>}
        {bans.map((b, i) => (
          <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '80px 200px 1fr 160px auto', gap: 12, padding: '12px 0', borderBottom: i < bans.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: typeColors[b.type] }}>{b.type}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-1)', wordBreak: 'break-all' }}>{b.value}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{b.reason || 'Aucune raison'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: b.permanent ? 'var(--red)' : 'var(--text-3)' }}>
              {b.permanent ? 'Permanent' : b.expiresAt ? formatDistanceToNow(new Date(b.expiresAt), { addSuffix: true, locale: fr }) : '—'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => removeBan(b.id)}>Lever</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LOGS ──────────────────────────────────────────────────────────────

function Logs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/logs?page=${page}`).then(r => { setLogs(r.data.logs); setPages(r.data.pages); setLoading(false); });
  }, [page]);

  const actionColors: Record<string, string> = {
    USER_BAN: 'var(--red)', USER_UNBAN: 'var(--green)', USER_PROMOTE: 'var(--accent-h)',
    POST_DELETE: 'var(--yellow)', THREAD_DELETE: 'var(--yellow)', THREAD_PIN: 'var(--cyan)',
    THREAD_CLOSE: 'var(--text-2)', VALIDATE: 'var(--green)',
  };

  return (
    <div style={card}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)', marginBottom: 16 }}>Journal d'administration</h3>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div> : (
        logs.map((log, i) => (
          <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '140px 120px 1fr 140px', gap: 12, padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: actionColors[log.action] || 'var(--text-2)' }}>{log.action}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-h)' }}>{log.admin?.username}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
              {log.reason || (log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : '—')}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
            </span>
          </div>
        ))
      )}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: page === i + 1 ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${page === i + 1 ? 'var(--accent)' : 'var(--border)'}`, fontFamily: 'var(--font-mono)', fontSize: 13, color: page === i + 1 ? '#fff' : 'var(--text-1)', cursor: 'pointer' }}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ForumManager() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '', icon: '' });
  const [newForum, setNewForum] = useState({ name: '', slug: '', description: '', categoryId: '' });

  const loadData = () => api.get('/forum/categories').then(r => setCategories(r.data));
  useEffect(() => { loadData(); }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // URL correcte : /forum/categories
      await api.post('/forum/categories', newCat);
      toast.success('Catégorie créée !');
      setNewCat({ name: '', slug: '', description: '', icon: '' });
      loadData();
    } catch (err: any) { 
      toast.error(err.response?.data?.error || 'Erreur création catégorie'); 
    }
  };
  
  const handleCreateForum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // ATTENTION : Ta route backend pour créer un forum est '/' et non '/forums'
      // On appelle donc juste '/forum'
      await api.post('/forum', newForum); 
      toast.success('Forum ajouté !');
      setNewForum({ name: '', slug: '', description: '', categoryId: '' });
      loadData();
    } catch (err: any) { 
      toast.error(err.response?.data?.error || 'Erreur création forum'); 
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Formulaire Catégorie */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-0)', marginBottom: 15 }}>📁 Nouvelle Catégorie</h3>
        <form onSubmit={handleCreateCategory} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
          <input className="input" placeholder="Nom (ex: Gaming)" value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value, slug: e.target.value.toLowerCase().replace(/ /g, '-')})} />
          <input className="input" placeholder="Slug (ex: gaming)" value={newCat.slug} onChange={e => setNewCat({...newCat, slug: e.target.value})} />
          <button className="btn btn-primary" type="submit">Créer</button>
        </form>
      </div>

      {/* Formulaire Forum */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-0)', marginBottom: 15 }}>💬 Nouveau Forum</h3>
        <form onSubmit={handleCreateForum} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input" placeholder="Nom du forum" value={newForum.name} onChange={e => setNewForum({...newForum, name: e.target.value, slug: e.target.value.toLowerCase().replace(/ /g, '-')})} />
            <select className="input" value={newForum.categoryId} onChange={e => setNewForum({...newForum, categoryId: e.target.value})}>
              <option value="">Choisir une catégorie...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <input className="input" placeholder="Slug du forum" value={newForum.slug} onChange={e => setNewForum({...newForum, slug: e.target.value})} />
            <button className="btn btn-primary" type="submit">Ajouter au forum</button>
          </div>
        </form>
      </div>

      {/* Liste actuelle */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-0)', marginBottom: 15 }}>Structure actuelle</h3>
        {categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 15, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
            <strong style={{ color: 'var(--accent-h)' }}>{cat.name}</strong>
            <div style={{ marginLeft: 20, marginTop: 5, fontSize: 12 }}>
              {cat.forums?.map((f: any) => <div key={f.id}>• {f.name} <span style={{ color: 'var(--text-3)' }}>({f.slug})</span></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── MAIN ADMIN PAGE ───────────────────────────────────────────────────

const TABS = [
  { path: '/admin', label: '📊 Dashboard', exact: true },
  { path: '/admin/users', label: '👥 Utilisateurs' },
  { path: '/admin/forum', label: '📁 Catégories & Forums' },
  { path: '/admin/reports', label: '🚩 Signalements' },
  { path: '/admin/bans', label: '🚫 Bannissements' },
  { path: '/admin/logs', label: '📋 Logs admin' },
];

export default function AdminPage() {
  const { user } = useAuthStore();
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>🛡️</span>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>Administration</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>Connecté en tant que <strong style={{ color: 'var(--accent-h)' }}>{user?.username}</strong> · {user?.role}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TABS.filter(t => user?.role === 'ADMIN' || t.path !== '/admin').map(tab => {
          const active = tab.exact ? location.pathname === tab.path : location.pathname.startsWith(tab.path) && tab.path !== '/admin';
          const isActive = tab.exact ? location.pathname === '/admin' : location.pathname === tab.path;
          return (
            <Link key={tab.path} to={tab.path}
              style={{
                padding: '8px 16px',
                background: isActive ? 'var(--accent)' : 'var(--bg-2)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)', fontSize: 13,
                color: isActive ? '#fff' : 'var(--text-1)',
                textDecoration: 'none', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="forum" element={<ForumManager />} />
        <Route path="reports" element={<Reports />} />
        <Route path="bans" element={<Bans />} />
        <Route path="logs" element={<Logs />} />
      </Routes>
    </div>
  );
}
