import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  status: string;
  rank: string;
  points: number;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,

      setAuth: (user, token) => {
        set({ user, token });
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {}
        set({ user: null, token: null });
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/';
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const token = get().token;
          if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }
          const { data } = await api.get('/auth/check');
          if (data.authenticated) {
            set({ user: data.user, isLoading: false });
          } else {
            set({ user: null, token: null, isLoading: false });
          }
        } catch {
          set({ user: null, token: null, isLoading: false });
        }
      },
    }),
    {
      name: 'forum-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
