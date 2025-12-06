import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  setAuth: (token: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isHydrated: false,

      setAuth: (token) => {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          set({
            token,
            user: { username: payload.sub, role: payload.role || 'user' },
            isAuthenticated: true,
          });
        } catch {
          set({ token, isAuthenticated: true });
        }
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      setHydrated: () => {
        set({ isHydrated: true });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          try {
            const payload = JSON.parse(atob(state.token.split('.')[1]));
            state.user = { username: payload.sub, role: payload.role || 'user' };
            state.isAuthenticated = true;
          } catch {
            state.isAuthenticated = true;
          }
        }
        state?.setHydrated();
      },
    }
  )
);
