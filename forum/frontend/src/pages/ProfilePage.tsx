import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../hooks/useAuth';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', signature: '', country: '', avatarUrl: '' });

  const isMe = me?.username === username;

  useEffect(() => {
    api.get(`/users/${username}`)
      .then(r => { setProfile(r.data); setEditForm({ bio: r.data.bio || '', signature: r.data.signature || '', country: r.data.country || '', avatarUrl: r.data.avatarUrl || '' }); setLoading(false); })
      .catch(() => setLoading(false));
  }, [username]);

  async function toggleFollow() {
    try {
      const { data } = await api.post(`/users/${profile.id}/follow`);
      setFollowing(data.following);
      toast.success(data.following ? 'Suivi !' : 'Désabonné.');
    } catch {}
  }

  async function saveProfile() {
    try {
      const { data } = await api.patch('/users/me/profile', editForm);
      setProfile((p: any) => ({ ...p, ...data }));
      setEditing(false);
      toast.success('Profil mis à jour !');
    } catch {}
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:80}}><div className="spinner" /></div>;
  if (!profile) return <div style={{textAlign:'center',padding:80,fontFamily:'var(--font-mono)',color:'var(--text-2)'}}>Utilisateur introuvable.</div>;

  const rankColors: Record<string, string> = { 'Nouveau':'var(--rank-nouveau)','Actif':'var(--rank-actif)','Confirmé':'var(--rank-confirme)','Expert':'var(--rank-expert)','Légende':'var(--rank-legende)' };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {/* Profile card */}
      <div style={{background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
        {/* Banner */}
        <div style={{height:80,background:`linear-gradient(135deg, var(--accent-d), var(--bg-3))`}} />

        <div style={{padding:24,marginTop:-40}}>
          {/* Avatar */}
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:16}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:'var(--accent)',border:'4px solid var(--bg-1)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:28,fontWeight:700,color:'#fff',overflow:'hidden'}}>
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.username} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : profile.username[0].toUpperCase()}
            </div>
            <div style={{display:'flex',gap:8}}>
              {isMe ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
                  {editing ? 'Annuler' : '✏️ Modifier'}
                </button>
              ) : (
                <>
                  <button className={`btn btn-sm ${following ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleFollow}>
                    {following ? 'Abonné ✓' : '+ Suivre'}
                  </button>
                  <Link to={`/messages?with=${profile.id}`} className="btn btn-ghost btn-sm">✉️ MP</Link>
                </>
              )}
            </div>
          </div>

          {/* Name & rank */}
          <h1 style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:700,color:'var(--text-0)',marginBottom:4}}>{profile.username}</h1>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:rankColors[profile.rank] || 'var(--text-2)',fontWeight:700}}>{profile.rank}</span>
            {profile.role !== 'USER' && (
              <span className={`badge ${profile.role === 'ADMIN' ? 'badge-admin' : 'badge-mod'}`}>{profile.role}</span>
            )}
            {profile.country && <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-2)'}}>📍 {profile.country}</span>}
          </div>

          {/* Stats */}
          <div style={{display:'flex',gap:24,marginBottom:16}}>
            {[
              { label: 'Messages', val: profile._count?.posts || 0 },
              { label: 'Sujets', val: profile._count?.threads || 0 },
              { label: 'Points', val: profile.points },
              { label: 'Abonnés', val: profile._count?.followers || 0 },
            ].map(s => (
              <div key={s.label} style={{textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:700,color:'var(--text-0)'}}>{s.val.toLocaleString()}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)'}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Bio */}
          {!editing && profile.bio && (
            <p style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-1)',lineHeight:1.7,marginBottom:12}}>{profile.bio}</p>
          )}

          {/* Edit form */}
          {editing && (
            <div style={{display:'flex',flexDirection:'column',gap:12,padding:16,background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',marginBottom:12}}>
              <div className="form-group">
                <label className="form-label">Avatar URL</label>
                <input className="input" value={editForm.avatarUrl} onChange={e => setEditForm(f => ({...f, avatarUrl: e.target.value}))} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea className="input" value={editForm.bio} onChange={e => setEditForm(f => ({...f, bio: e.target.value}))} rows={3} maxLength={1000} style={{resize:'vertical'}} />
              </div>
              <div className="form-group">
                <label className="form-label">Signature</label>
                <input className="input" value={editForm.signature} onChange={e => setEditForm(f => ({...f, signature: e.target.value}))} maxLength={500} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveProfile} style={{alignSelf:'flex-start'}}>Sauvegarder</button>
            </div>
          )}

          {/* Badges */}
          {profile.badges?.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {profile.badges.map((ub: any) => (
                <div key={ub.badge.id} title={ub.badge.description}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:100,fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-1)'}}>
                  {ub.badge.icon} {ub.badge.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Member since */}
      <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-3)',textAlign:'center'}}>
        Membre depuis {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true, locale: fr })}
        {profile.lastSeenAt && ` · Vu ${formatDistanceToNow(new Date(profile.lastSeenAt), { addSuffix: true, locale: fr })}`}
      </div>
    </div>
  );
}
