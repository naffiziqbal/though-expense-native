import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { captureError } from './sentry';

export const DAILY_REMINDER_ID = 'daily-log-reminder';

/** Foreground presentation. Set once, at module load, before any listener runs. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Android needs an explicit channel or notifications arrive silently. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0E9488',
    showBadge: true,
  });
}

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable';

export async function getPermissionStatus(): Promise<PermissionOutcome> {
  if (!Device.isDevice) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * Ask for permission only when `interactive` — iOS shows the system prompt
 * once per install, so we save it for an explicit opt-in.
 */
export async function requestPermission(interactive: boolean): Promise<PermissionOutcome> {
  if (!Device.isDevice) return 'unavailable';

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return 'granted';
  if (!interactive && !existing.canAskAgain) return 'denied';
  if (!interactive && existing.status === 'denied') return 'denied';

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/** Expo push token for this install, or null if unavailable/not permitted. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const id = projectId();
  if (!id) {
    captureError(new Error('Missing EAS projectId for Expo push'), { source: 'getExpoPushToken' });
    return null;
  }

  try {
    await ensureAndroidChannel();
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return data || null;
  } catch (error) {
    captureError(error, { source: 'getExpoPushToken' });
    return null;
  }
}

/**
 * Replace the daily reminder with one scheduled at `hour:minute` local time.
 * Local (not server-pushed) so it fires on time in any timezone and offline.
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  await cancelDailyReminder();
  if (!Device.isDevice) return false;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return false;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Log today’s expenses',
      body: 'Takes 10 seconds — just type what you spent.',
      data: { screen: 'add' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'default',
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch {
    // nothing scheduled
  }
}

const SCREEN_ROUTES: Record<string, string> = {
  dashboard: '/(tabs)',
  add: '/(tabs)/add',
  expenses: '/(tabs)/expenses',
  insights: '/(tabs)/insights',
  budget: '/budget',
  recurring: '/recurring',
};

/** Map a notification payload to an app route. */
export function routeForNotification(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const screen = (data as { screen?: unknown }).screen;
  if (typeof screen !== 'string') return null;
  return SCREEN_ROUTES[screen] ?? null;
}
