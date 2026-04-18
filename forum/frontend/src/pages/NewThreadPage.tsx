// NewThreadPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

export default function NewThreadPage() {
  const { forumId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { toast.error('Titre et contenu requis.'); return; }
    setSubmitting(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const { data } = await api.post('/threads', { title, content, forumId, tags: tagList });
      toast.success('Sujet créé !');
      navigate(`/thread/${data.slug}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur.');
    } finally { setSubmitting(false); }
  }

  const s = { background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:32,display:'flex',flexDirection:'column' as const,gap:20 };

  return (
    <div style={s}>
      <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:'var(--text-0)'}}>Nouveau sujet</h1>
      <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
        <div className="form-group">
          <label className="form-label">Titre</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre du sujet..." maxLength={200} />
        </div>
        <div className="form-group">
          <label className="form-label">Contenu</label>
          <textarea className="input" value={content} onChange={e => setContent(e.target.value)}
            placeholder="Écrivez votre message..." rows={12} style={{resize:'vertical',fontFamily:'var(--font-mono)',lineHeight:1.7}} />
        </div>
        <div className="form-group">
          <label className="form-label">Tags (optionnel, séparés par virgule)</label>
          <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="tag1, tag2, tag3" />
        </div>
        <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Création...' : 'Créer le sujet →'}
          </button>
        </div>
      </form>
    </div>
  );
}
