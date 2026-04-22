import axios from 'axios';

const api = axios.create({
  // On utilise la variable d'environnement définie sur Render, sinon fallback sur localhost
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  withCredentials: true,
  timeout: 15000,
});

// Always inject JS-enabled header
api.interceptors.request.use((config) => {
  config.headers['X-JS-Enabled'] = '1';
  config.headers['X-Fingerprint'] = getFingerprint();
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('forum-auth');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Browser fingerprint generation
function getFingerprint(): string {
  const cached = sessionStorage.getItem('_fp');
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Forum fingerprint 🔐', 2, 2);
  }
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
    navigator.hardwareConcurrency,
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash |= 0;
  }
  const fp = Math.abs(hash).toString(36);
  sessionStorage.setItem('_fp', fp);
  return fp;
}

export default api;
