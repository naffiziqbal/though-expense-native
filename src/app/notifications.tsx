import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import { captureError } from '../lib/sentry';
import {
  cancelDailyReminder,
  getExpoPushToken,
  getPermissionStatus,
  requestPermission,
  scheduleDailyReminder,
  type PermissionOutcome,
} from '../lib/notifications';
import { toast } from '../store/toastStore';
import { useNotificationStore } from '../store/notificationStore';

function formatTime(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}

function ToggleRow({ icon, title, subtitle, value, disabled, onChange, last }: RowProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>
          {title}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.bgCard}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const {
    pushEnabled,
    budgetAlertsEnabled,
    reminderEnabled,
    reminderHour,
    reminderMinute,
    setServerPrefs,
    setReminder,
    setRegisteredToken,
  } = useNotificationStore();

  const [permission, setPermission] = useState<PermissionOutcome>('denied');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [status, prefs] = await Promise.all([
        getPermissionStatus(),
        api.getNotificationPreferences().catch((error) => {
          toast.error(getErrorMessage(error, 'Could not load notification settings'));
          return null;
        }),
      ]);
      setPermission(status);
      if (prefs?.success) setServerPrefs(prefs.data);
      setIsLoading(false);
    })();
  }, [setServerPrefs]);

  const savePrefs = useCallback(
    async (patch: { pushEnabled?: boolean; budgetAlertsEnabled?: boolean }) => {
      const previous = { pushEnabled, budgetAlertsEnabled };
      setServerPrefs({ ...previous, ...patch });
      setIsSaving(true);
      try {
        const res = await api.updateNotificationPreferences(patch);
        if (res.success) setServerPrefs(res.data);
      } catch (error) {
        setServerPrefs(previous);
        toast.error(getErrorMessage(error, 'Could not save preferences'));
      } finally {
        setIsSaving(false);
      }
    },
    [budgetAlertsEnabled, pushEnabled, setServerPrefs]
  );

  /** Turning push on may need the OS prompt and a fresh token registration. */
  const handlePushToggle = async (next: boolean) => {
    if (!next) {
      await savePrefs({ pushEnabled: false });
      return;
    }

    const outcome = await requestPermission(true);
    setPermission(outcome);

    if (outcome === 'unavailable') {
      toast.error('Push notifications need a physical device');
      return;
    }
    if (outcome === 'denied') {
      toast.error('Enable notifications for ThoughtExpense in system settings');
      return;
    }

    const token = await getExpoPushToken();
    if (!token) {
      toast.error(
        'Could not get a push token. This build needs FCM (Android) or APNs (iOS) credentials in Expo.'
      );
      return;
    }

    try {
      await api.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
      setRegisteredToken(token);
    } catch (error) {
      captureError(error, { source: 'registerPushToken' });
      toast.error(getErrorMessage(error, 'Could not register this device for push'));
      return;
    }

    await savePrefs({ pushEnabled: true });
  };

  const handleReminderToggle = async (next: boolean) => {
    if (!next) {
      setReminder(false);
      await cancelDailyReminder();
      return;
    }

    const outcome = await requestPermission(true);
    setPermission(outcome);
    if (outcome !== 'granted') {
      toast.error(
        outcome === 'unavailable'
          ? 'Reminders need a physical device'
          : 'Enable notifications for ThoughtExpense in system settings'
      );
      return;
    }

    const scheduled = await scheduleDailyReminder(reminderHour, reminderMinute);
    if (!scheduled) {
      toast.error('Could not schedule the reminder');
      return;
    }
    setReminder(true);
    toast.success(`Reminder set for ${formatTime(reminderHour, reminderMinute)}`);
  };

  const applyTime = async (hour: number, minute: number) => {
    setReminder(reminderEnabled, hour, minute);
    if (reminderEnabled) await scheduleDailyReminder(hour, minute);
  };

  const handleAndroidTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    setTimePickerOpen(false);
    if (event.type === 'set' && date) void applyTime(date.getHours(), date.getMinutes());
  };

  const handleTest = async () => {
    try {
      const res = await api.sendTestPush();
      if (res.data.delivered > 0) toast.success('Test notification sent');
      else toast.error('No registered devices yet — toggle push on first');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not send test notification'));
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <View style={{ paddingVertical: spacing.s8, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const timeValue = new Date();
  timeValue.setHours(reminderHour, reminderMinute, 0, 0);

  return (
    <Screen>
      {permission === 'denied' ? (
        <Card style={{ backgroundColor: colors.warningSoft, gap: spacing.s2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
            <Ionicons name="notifications-off" size={18} color={colors.warning} />
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>
              Notifications are blocked
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
            ThoughtExpense can’t send anything until you allow notifications for this app.
          </Text>
          <Button title="Open settings" variant="outline" onPress={() => Linking.openSettings()} />
        </Card>
      ) : null}

      <View style={{ gap: spacing.s2 }}>
        <Text style={styles.sectionLabel}>FROM THOUGHTEXPENSE</Text>
        <Card padded={false}>
          <ToggleRow
            icon="notifications"
            title="Push notifications"
            subtitle="Weekly briefings and auto-logged expenses"
            value={pushEnabled}
            disabled={isSaving}
            onChange={handlePushToggle}
          />
          <ToggleRow
            icon="pie-chart"
            title="Budget alerts"
            subtitle="A nudge at 80% and 100% of your monthly budget"
            value={budgetAlertsEnabled}
            disabled={isSaving || !pushEnabled}
            onChange={(next) => savePrefs({ budgetAlertsEnabled: next })}
            last
          />
        </Card>
      </View>

      <View style={{ gap: spacing.s2 }}>
        <Text style={styles.sectionLabel}>ON THIS DEVICE</Text>
        <Card padded={false}>
          <ToggleRow
            icon="alarm"
            title="Daily logging reminder"
            subtitle="One reminder a day, scheduled on your phone"
            value={reminderEnabled}
            onChange={handleReminderToggle}
            last={!reminderEnabled}
          />
          {reminderEnabled ? (
            <Pressable onPress={() => setTimePickerOpen(true)} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: colors.border }]}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>
                  Reminder time
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
                  {formatTime(reminderHour, reminderMinute)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Card>
      </View>

      <Button title="Send a test notification" variant="outline" onPress={handleTest} />

      {timePickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker value={timeValue} mode="time" display="default" onChange={handleAndroidTimeChange} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={timePickerOpen}
          onClose={() => setTimePickerOpen(false)}
          title="Reminder time"
        >
          <DateTimePicker
            value={timeValue}
            mode="time"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={(_, date) => {
              if (date) void applyTime(date.getHours(), date.getMinutes());
            }}
          />
          <Button title="Done" onPress={() => setTimePickerOpen(false)} />
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.semibold,
    letterSpacing: 1,
    color: '#8A98A5',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    minHeight: 64,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
