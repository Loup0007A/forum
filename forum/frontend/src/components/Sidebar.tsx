// Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';

const NAV = [
  { icon: '⌂', label: 'Accueil', path: '/forum' },
  { icon: '🔍', label: 'Recherche', path: '/search' },
  { icon: '✉', label: 'Messages', path: '/messages' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();

  return (
    <aside style={{
      width: 200, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {NAV.map(n => (
        <Link key={n.path} to={n.path} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: pathname === n.path ? 'var(--bg-3)' : 'transparent',
          border: `1px solid ${pathname === n.path ? 'var(--border-h)' : 'transparent'}`,
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: pathname === n.path ? 'var(--text-0)' : 'var(--text-2)',
          textDecoration: 'none',
          transition: 'all 0.15s',
        }}>
          <span>{n.icon}</span> {n.label}
        </Link>
      ))}
      {user && ['MODERATOR', 'ADMIN'].includes(user.role) && (
        <Link to="/admin" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: pathname.startsWith('/admin') ? 'rgba(139,92,246,0.1)' : 'transparent',
          border: `1px solid ${pathname.startsWith('/admin') ? 'var(--accent)' : 'transparent'}`,
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: pathname.startsWith('/admin') ? 'var(--accent-h)' : 'var(--text-2)',
          textDecoration: 'none',
          marginTop: 16,
        }}>
          <span>🛡️</span> Admin
        </Link>
      )}
    </aside>
  );
}
