// Ported from client/store/authStore.ts (AsyncStorage persistence, SecureStore token)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api, setUnauthorizedHandler } from '../lib/api';
import { resetBilling } from '../lib/billing';
import { clearExpenseCache } from '../lib/expenseCache';
import { cancelDailyReminder } from '../lib/notifications';
import type { User } from '../lib/types';
import { useNotificationStore } from './notificationStore';
import { useOutboxStore } from './outboxStore';
import { usePendingStore } from './pendingStore';
import { celebratePremiumUpgrade } from './premiumWelcomeStore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;
  /** Server revoked the session until the password is reset; login routes to forgot-password. */
  passwordResetRequired: boolean;

  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setHasHydrated: (hydrated: boolean) => void;
  setPasswordResetRequired: (required: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      _hasHydrated: false,
      passwordResetRequired: false,

      setUser: (user) => {
        const prev = get().user;
        const normalized = { ...user, isPremium: user.isPremium ?? false };
        celebratePremiumUpgrade(prev?.isPremium, normalized.isPremium);
        set({
          user: normalized,
          isAuthenticated: true,
          error: null,
        });
      },

      clearUser: () => set({ user: null, isAuthenticated: false }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

      setPasswordResetRequired: (required) => set({ passwordResetRequired: required }),

      logout: async () => {
        // Stop pushes to this device before the token is discarded, so the next
        // account signing in here doesn't inherit the previous user's alerts.
        const { registeredToken, setRegisteredToken } = useNotificationStore.getState();
        if (registeredToken) {
          await api.unregisterPushToken(registeredToken).catch(() => {});
          setRegisteredToken(null);
        }
        await cancelDailyReminder();

        await api.logout();
        await resetBilling();
        usePendingStore.getState().clear();
        // Unsent offline saves belong to the account that made them.
        useOutboxStore.getState().clear();
        await clearExpenseCache();
        set({ user: null, isAuthenticated: false, error: null });
      },

      checkAuth: async () => {
        const token = await api.loadToken();

        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // If we already have user data from hydration, skip the API call
        const currentUser = get().user;
        if (currentUser && get()._hasHydrated) {
          set({ isAuthenticated: true, isLoading: false });
          return;
        }

        try {
          set({ isLoading: true });
          const response = await api.getCurrentUser();
          if (response.success) {
            const prev = get().user;
            const next = { ...response.data.user, isPremium: response.data.user.isPremium ?? false };
            celebratePremiumUpgrade(prev?.isPremium, next.isPremium);
            set({
              user: next,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({ isLoading: false });
          }
        } catch {
          await api.clearToken();
          set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// When any request 401s, drop the session.
setUnauthorizedHandler(({ passwordResetRequired }) => {
  if (passwordResetRequired) useAuthStore.getState().setPasswordResetRequired(true);
  useAuthStore.getState().clearUser();
  void clearExpenseCache();
});
