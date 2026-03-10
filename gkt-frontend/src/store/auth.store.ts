import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  product_id: string;
  tenant_id?: string;
  onboarding_step?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('gkt_token', token);
    localStorage.setItem('gkt_user', JSON.stringify(user));
    set({ user, token });
  },
  clearAuth: () => {
    localStorage.removeItem('gkt_token');
    localStorage.removeItem('gkt_user');
    set({ user: null, token: null });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('gkt_token');
    const userStr = localStorage.getItem('gkt_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token });
      } catch {
        set({ user: null, token: null });
      }
    }
  },
}));
