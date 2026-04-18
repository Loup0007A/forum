import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import styles from './RegisterPage.module.css';

const COUNTRIES = [
  'France', 'Belgique', 'Suisse', 'Canada', 'Luxembourg',
  'Maroc', 'Algérie', 'Tunisie', 'Sénégal', 'Côte d\'Ivoire',
  'États-Unis', 'Royaume-Uni', 'Allemagne', 'Espagne', 'Italie',
  'Portugal', 'Pays-Bas', 'Autre'
];

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8,   label: '8 caractères minimum' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Une majuscule' },
  { test: (p: string) => /[0-9]/.test(p), label: 'Un chiffre' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Un caractère spécial' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    age: '', country: '', acceptRules: false, acceptPrivacy: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: any) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const passwordStrength = PASSWORD_RULES.filter(r => r.test(form.password)).length;

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!form.username || form.username.length < 3) e.username = 'Pseudo trop court (3 min)';
    if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) e.username = 'Caractères invalides';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide';
    if (form.password.length < 8) e.password = 'Mot de passe trop court';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    if (form.age && (parseInt(form.age) < 13 || parseInt(form.age) > 120)) e.age = 'Âge invalide';
    if (!form.acceptRules) e.acceptRules = 'Vous devez accepter les règles';
    if (!form.acceptPrivacy) e.acceptPrivacy = 'Vous devez accepter la politique de confidentialité';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      await api.post('/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password,
        age: form.age || undefined,
        country: form.country || undefined,
        acceptRules: form.acceptRules,
        acceptPrivacy: form.acceptPrivacy,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'inscription.';
      toast.error(msg);
      if (msg.includes('pseudo') || msg.includes('email')) setStep(1);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.grid} aria-hidden />
        <div className={styles.container}>
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>Demande envoyée !</h2>
            <p className={styles.successText}>
              Votre inscription a été transmise à l'administrateur.<br />
              Vous recevrez une confirmation par email une fois votre compte validé.
            </p>
            <div className={styles.successCode}>
              <span className={styles.codeComment}>// statut : EN_ATTENTE_VALIDATION</span>
              <span className={styles.codeComment}>// délai estimé : quelques heures</span>
            </div>
            <Link to="/" className={styles.backBtn}>← Retour à la connexion</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <span className={styles.bracket}>[</span>
            <span className={styles.logoText}>FORUM</span>
            <span className={styles.bracket}>]</span>
          </div>
          <p className={styles.subtitle}>Demande d'accès</p>
        </div>

        {/* Step indicator */}
        <div className={styles.steps}>
          {[1, 2].map(s => (
            <div key={s} className={`${styles.step} ${s === step ? styles.stepActive : ''} ${s < step ? styles.stepDone : ''}`}>
              <div className={styles.stepCircle}>{s < step ? '✓' : s}</div>
              <span className={styles.stepLabel}>{s === 1 ? 'Identifiants' : 'Profil & Règles'}</span>
            </div>
          ))}
          <div className={styles.stepLine} />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>→ Pseudo</label>
              <input className={`${styles.input} ${errors.username ? styles.inputError : ''}`}
                value={form.username} onChange={e => set('username', e.target.value)}
                placeholder="votre_pseudo" maxLength={30} />
              {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
              <span className={styles.hint}>Lettres, chiffres, tirets et underscores uniquement</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>→ Email</label>
              <input className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="votre@email.com" />
              {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>→ Mot de passe</label>
              <input className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                type="password" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="••••••••••••" />
              {errors.password && <span className={styles.fieldError}>{errors.password}</span>}

              {/* Password strength */}
              {form.password && (
                <div className={styles.strength}>
                  <div className={styles.strengthBars}>
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`${styles.strengthBar} ${i < passwordStrength ? styles[`strength${passwordStrength}`] : ''}`} />
                    ))}
                  </div>
                  <div className={styles.strengthRules}>
                    {PASSWORD_RULES.map((r, i) => (
                      <span key={i} className={`${styles.rule} ${r.test(form.password) ? styles.ruleOk : ''}`}>
                        {r.test(form.password) ? '✓' : '○'} {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>→ Confirmer le mot de passe</label>
              <input className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                placeholder="••••••••••••" />
              {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
            </div>

            <button className={styles.nextBtn} onClick={() => validateStep1() && setStep(2)}>
              Suivant <span>→</span>
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className={styles.form}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>→ Âge (optionnel)</label>
                <input className={`${styles.input} ${errors.age ? styles.inputError : ''}`}
                  type="number" value={form.age} onChange={e => set('age', e.target.value)}
                  placeholder="25" min={13} max={120} />
                {errors.age && <span className={styles.fieldError}>{errors.age}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>→ Pays (optionnel)</label>
                <select className={styles.input} value={form.country} onChange={e => set('country', e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Rules */}
            <div className={styles.rulesBox}>
              <h3 className={styles.rulesTitle}>📋 Règles du forum</h3>
              <ul className={styles.rulesList}>
                <li>Respect mutuel entre tous les membres</li>
                <li>Aucun contenu illégal ou offensant</li>
                <li>Pas de spam ni de publicité</li>
                <li>Confidentialité du forum (contenu privé)</li>
                <li>L'administration se réserve le droit de bannir</li>
              </ul>
            </div>

            <label className={`${styles.checkLabel} ${errors.acceptRules ? styles.checkError : ''}`}>
              <input type="checkbox" checked={form.acceptRules} onChange={e => set('acceptRules', e.target.checked)} />
              <span>J'accepte les <strong>règles du forum</strong></span>
            </label>
            {errors.acceptRules && <span className={styles.fieldError}>{errors.acceptRules}</span>}

            <label className={`${styles.checkLabel} ${errors.acceptPrivacy ? styles.checkError : ''}`}>
              <input type="checkbox" checked={form.acceptPrivacy} onChange={e => set('acceptPrivacy', e.target.checked)} />
              <span>J'accepte la <strong>politique de confidentialité</strong> (RGPD)</span>
            </label>
            {errors.acceptPrivacy && <span className={styles.fieldError}>{errors.acceptPrivacy}</span>}

            <div className={styles.btnRow}>
              <button className={styles.backBtn2} onClick={() => setStep(1)}>← Retour</button>
              <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
                {loading ? <><span className={styles.spinner} /> Envoi...</> : 'Envoyer la demande →'}
              </button>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <Link to="/" className={styles.loginLink}>← Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
