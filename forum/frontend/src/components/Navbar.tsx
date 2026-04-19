import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';
import styles from './Navbar.module.css';

interface NavbarProps {
  onChatToggle: () => void;
  chatOpen: boolean;
}

export default function Navbar({ onChatToggle, chatOpen }: NavbarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications] = useState(0); // TODO: wire to notif store
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link to="/forum" className={styles.logo}>
          <span className={styles.bracket}>[</span>
          <span className={styles.logoText}>FORUM</span>
          <span className={styles.bracket}>]</span>
        </Link>

        {/* Search */}
        <form className={styles.search} onSubmit={handleSearch}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
          />
          <kbd className={styles.kbd}>↵</kbd>
        </form>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Chat toggle */}
          <button
            className={`${styles.iconBtn} ${chatOpen ? styles.iconBtnActive : ''}`}
            onClick={onChatToggle}
            title="Chat en direct"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>

          {/* Messages */}
          <Link to="/messages" className={styles.iconBtn} title="Messages privés">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </Link>

          {/* Notifications */}
          <button className={styles.iconBtn} title="Notifications" style={{ position: 'relative' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifications > 0 && <span className={styles.notifBadge}>{notifications}</span>}
          </button>

          {/* User menu */}
          {user && (
            <div className={styles.userMenu} ref={menuRef}>
              <button className={styles.userBtn} onClick={() => setMenuOpen(o => !o)}>
                <div className={styles.avatar}>
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.username} />
                    : <span>{user.username[0].toUpperCase()}</span>}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.username}>{user.username}</span>
                  <span className={`${styles.rank} rank-${user.rank.toLowerCase()}`}>{user.rank}</span>
                </div>
                <span className={styles.chevron}>{menuOpen ? '▴' : '▾'}</span>
              </button>

              {menuOpen && (
                <div className={styles.dropdown}>
                  <Link to={`/profile/${user.username}`} className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                    <span>👤</span> Profil
                  </Link>
                  <Link to="/messages" className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                    <span>✉️</span> Messages
                  </Link>
                  {['MODERATOR', 'ADMIN'].includes(user.role) && (
                    <Link to="/admin" className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                      <span>🛡️</span> Administration
                    </Link>
                  )}
                  <div className={styles.dropDivider} />
                  <button className={`${styles.dropItem} ${styles.dropDanger}`} onClick={logout}>
                    <span>🚪</span> Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
