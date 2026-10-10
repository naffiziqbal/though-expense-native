import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyNudgeState, markShown, type NudgeKind, type NudgeUserState } from '../lib/nudges';

interface NudgeStoreState {
  /** Persisted per user id, so switching accounts on one device doesn't share schedules. */
  byUser: Record<string, NudgeUserState>;
  /** Runtime only: the nudge currently on screen. */
  active: NudgeKind | null;

  stateFor: (userId: string) => NudgeUserState;
  show: (userId: string, kind: NudgeKind) => void;
  dismiss: () => void;
}

export const useNudgeStore = create<NudgeStoreState>()(
  persist(
    (set, get) => ({
      byUser: {},
      active: null,

      stateFor: (userId) => get().byUser[userId] ?? emptyNudgeState(),

      show: (userId, kind) =>
        set((s) => ({
          active: kind,
          byUser: { ...s.byUser, [userId]: markShown(s.byUser[userId] ?? emptyNudgeState(), kind, Date.now()) },
        })),

      dismiss: () => set({ active: null }),
    }),
    {
      name: 'thoughtexpense-nudges',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ byUser: s.byUser }),
    }
  )
);
