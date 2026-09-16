import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface NotificationState {
  /** Server-side master switch, mirrored locally so the UI renders instantly. */
  pushEnabled: boolean;
  budgetAlertsEnabled: boolean;
  /** Purely local: a scheduled on-device notification, not a server push. */
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  /** Token currently registered with the server, so we can unregister on logout. */
  registeredToken: string | null;
  /** Set once we've asked for permission, to avoid re-prompting on every launch. */
  hasPrompted: boolean;

  setServerPrefs: (prefs: { pushEnabled: boolean; budgetAlertsEnabled: boolean }) => void;
  setReminder: (enabled: boolean, hour?: number, minute?: number) => void;
  setRegisteredToken: (token: string | null) => void;
  setHasPrompted: (value: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      pushEnabled: true,
      budgetAlertsEnabled: true,
      reminderEnabled: false,
      reminderHour: 21,
      reminderMinute: 0,
      registeredToken: null,
      hasPrompted: false,

      setServerPrefs: (prefs) => set(prefs),

      setReminder: (enabled, hour, minute) =>
        set((s) => ({
          reminderEnabled: enabled,
          reminderHour: hour ?? s.reminderHour,
          reminderMinute: minute ?? s.reminderMinute,
        })),

      setRegisteredToken: (registeredToken) => set({ registeredToken }),

      setHasPrompted: (hasPrompted) => set({ hasPrompted }),
    }),
    {
      name: 'thoughtexpense-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
