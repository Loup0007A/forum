import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [glitch, setGlitch] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/forum';

  // Glitch effect on error
  useEffect(() => {
    if (error) {
      setGlitch(true);
      const t = setTimeout(() => setGlitch(false), 600);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Load hCaptcha if needed
  useEffect(() => {
    if (requireCaptcha && HCAPTCHA_SITE_KEY) {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js';
      script.async = true;
      document.head.appendChild(script);
      (window as any).hcaptchaCallback = (token: string) => setCaptchaToken(token);
    }
  }, [requireCaptcha]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    if (requireCaptcha && !captchaToken) { setError('Veuillez compléter le CAPTCHA.'); return; }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password, captchaToken });
      setAuth(data.user, data.token);
      toast.success(`Bienvenue, ${data.user.username} !`);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erreur de connexion.';
      const left = err.response?.data?.attemptsLeft;
      const needCaptcha = err.response?.data?.requireCaptcha;
      const banned = err.response?.data?.banned;

      setError(msg);
      if (left !== undefined) setAttemptsLeft(left);
      if (needCaptcha) setRequireCaptcha(true);
      if (banned) setAttemptsLeft(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Animated grid background */}
      <div className={styles.grid} aria-hidden />
      <div className={styles.vignette} aria-hidden />

      {/* Floating particles */}
      <div className={styles.particles} aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className={styles.particle} style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }} />
        ))}
      </div>

      <div className={`${styles.container} ${glitch ? styles.glitch : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <span className={styles.logoBracket}>[</span>
            <span className={styles.logoText}>FORUM</span>
            <span className={styles.logoBracket}>]</span>
          </div>
          <div className={styles.terminal}>
            <span className={styles.terminalDot} style={{ background: '#ef4444' }} />
            <span className={styles.terminalDot} style={{ background: '#f59e0b' }} />
            <span className={styles.terminalDot} style={{ background: '#22c55e' }} />
            <span className={styles.terminalTitle}>session.init</span>
          </div>
          <p className={styles.subtitle}>Accès restreint — membres uniquement</p>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="email">
              <span className={styles.labelPrefix}>→</span> Email
            </label>
            <div className={styles.inputWrap}>
              <input
                id="email"
                type="email"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                autoFocus
                disabled={loading || attemptsLeft === 0}
              />
              <div className={styles.inputGlow} />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="password">
              <span className={styles.labelPrefix}>→</span> Mot de passe
            </label>
            <div className={styles.inputWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={loading || attemptsLeft === 0}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
              <div className={styles.inputGlow} />
            </div>
          </div>

          {/* CAPTCHA */}
          {requireCaptcha && HCAPTCHA_SITE_KEY && (
            <div
              className="h-captcha"
              data-sitekey={HCAPTCHA_SITE_KEY}
              data-callback="hcaptchaCallback"
              data-theme="dark"
              style={{ margin: '8px 0' }}
            />
          )}
          {requireCaptcha && !HCAPTCHA_SITE_KEY && (
            <div className={styles.captchaDevNote}>
              [DEV] CAPTCHA désactivé — configurez VITE_HCAPTCHA_SITE_KEY en production
            </div>
          )}

          {/* Error */}
          {error && (
            <div className={styles.errorBox} role="alert">
              <span className={styles.errorIcon}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Attempts warning */}
          {attemptsLeft !== null && attemptsLeft > 0 && (
            <div className={styles.warningBox}>
              <span>⚡ {attemptsLeft} tentative{attemptsLeft > 1 ? 's' : ''} restante{attemptsLeft > 1 ? 's' : ''} avant blocage</span>
            </div>
          )}

          {/* Banned state */}
          {attemptsLeft === 0 && (
            <div className={styles.bannedBox} role="alert">
              <span className={styles.errorIcon}>🚫</span>
              <span>Accès bloqué. Contactez l'administrateur.</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || attemptsLeft === 0}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Authentification...
              </>
            ) : (
              <>
                <span>Connexion</span>
                <span className={styles.arrow}>→</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerText}>Pas encore membre ?</span>
          <Link to="/register" className={styles.registerLink}>
            Demander l'accès
          </Link>
        </div>

        {/* Security indicator */}
        <div className={styles.security}>
          <span className={styles.securityDot} />
          <span>Connexion chiffrée · Argon2id · Session sécurisée</span>
        </div>
      </div>
    </div>
  );
}
