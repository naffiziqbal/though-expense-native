import { Platform } from 'react-native';
import { api } from './api';
import { captureError } from './sentry';
import { getExpoPushToken, scheduleDailyReminder } from './notifications';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Register this device's push token with the server (after permission is granted)
 * and restore the daily reminder if the user had it on. Returns false on failure.
 */
export async function registerThisDeviceForPush(): Promise<boolean> {
  const token = await getExpoPushToken();
  if (!token) return false;
  try {
    await api.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch (error) {
    captureError(error, { source: 'registerPushToken' });
    return false;
  }
  const store = useNotificationStore.getState();
  store.setRegisteredToken(token);
  store.setHasPrompted(true);
  if (store.reminderEnabled) await scheduleDailyReminder(store.reminderHour, store.reminderMinute);
  return true;
}
