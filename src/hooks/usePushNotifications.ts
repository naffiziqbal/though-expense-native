import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '../lib/api';
import {
  ensureAndroidChannel,
  getExpoPushToken,
  requestPermission,
  routeForNotification,
  scheduleDailyReminder,
} from '../lib/notifications';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Registers this device with the server once the user is signed in, and routes
 * notification taps. Mount once, at the root.
 */
export function usePushNotifications() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const userId = useAuthStore((s) => s.user?.id);
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    ensureAndroidChannel().catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId) return;
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;

    let cancelled = false;

    (async () => {
      // Android grants POST_NOTIFICATIONS silently on older versions and shows a
      // single system dialog on 13+, so registering on login is not intrusive.
      // iOS waits for the explicit opt-in on the notifications screen.
      const outcome = await requestPermission(Platform.OS === 'android');
      if (cancelled || outcome !== 'granted') return;

      const token = await getExpoPushToken();
      if (cancelled || !token) return;

      try {
        await api.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
        useNotificationStore.getState().setRegisteredToken(token);
        useNotificationStore.getState().setHasPrompted(true);
      } catch {
        // Retried on the next launch.
      }

      const { reminderEnabled, reminderHour, reminderMinute } = useNotificationStore.getState();
      if (reminderEnabled) {
        await scheduleDailyReminder(reminderHour, reminderMinute);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, userId]);

  useEffect(() => {
    if (!isAuthenticated) registeredFor.current = null;
  }, [isAuthenticated]);

  // Tap handling: both a cold start from a notification and a warm tap.
  useEffect(() => {
    let handled = false;

    const go = (data: unknown) => {
      const route = routeForNotification(data);
      if (route) router.push(route as never);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response || handled) return;
        handled = true;
        go(response.notification.request.content.data);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handled = true;
      go(response.notification.request.content.data);
    });

    return () => subscription.remove();
  }, [router]);
}
