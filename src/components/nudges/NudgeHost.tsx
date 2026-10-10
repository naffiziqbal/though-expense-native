import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { billingAvailable, getPremiumOffering } from '../../lib/billing';
import {
  ensureAndroidChannel,
  getPermissionDetails,
  requestPermission,
  type PermissionDetails,
} from '../../lib/notifications';
import { pickNudge } from '../../lib/nudges';
import { premiumOfferCopy, type PremiumOfferCopy } from '../../lib/premiumOffer';
import { registerThisDeviceForPush } from '../../lib/pushRegistration';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNudgeStore } from '../../store/nudgeStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { usePremiumWelcomeStore } from '../../store/premiumWelcomeStore';
import { toast } from '../../store/toastStore';

/** Only interrupt on the home tab, after the screen has settled. */
const HOME_PATH = '/';
const SETTLE_MS = 1500;

/**
 * Periodic nudges: turn on notifications, and (free users) upgrade to Premium.
 * Checked once per app foreground, on the home tab, never during the tour or
 * another modal. Scheduling rules live in lib/nudges.ts. Mount once at the root.
 */
export function NudgeHost() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const tourActive = useOnboardingStore((s) => s.isActive);
  const welcomeVisible = usePremiumWelcomeStore((s) => s.visible);
  const active = useNudgeStore((s) => s.active);
  const [hydrated, setHydrated] = useState(() => useNudgeStore.persist.hasHydrated());
  const [foregrounds, setForegrounds] = useState(0);
  const checkedKey = useRef('');

  useEffect(() => {
    if (hydrated) return;
    return useNudgeStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setForegrounds((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hydrated || !user || pathname !== HOME_PATH || tourActive || welcomeVisible || active) return;
    const key = `${user.id}:${foregrounds}`;
    if (checkedKey.current === key) return;

    const timer = setTimeout(async () => {
      checkedKey.current = key;
      const permission = await getPermissionDetails();

      // Granted in system settings (e.g. after our "Open settings") but never registered: fix it quietly.
      if (permission.status === 'granted' && !useNotificationStore.getState().registeredToken) {
        void registerThisDeviceForPush();
      }

      const signedUpAt = Date.parse(user.createdAt);
      const kind = pickNudge(useNudgeStore.getState().stateFor(user.id), {
        now: Date.now(),
        signedUpAt: Number.isFinite(signedUpAt) ? signedUpAt : Date.now(),
        isPremium: user.isPremium,
        notificationPermission: permission.status,
      });
      // Leaving home clears this timer (pathname is a dependency), so we're still on home here.
      if (kind) useNudgeStore.getState().show(user.id, kind);
    }, SETTLE_MS);

    return () => clearTimeout(timer);
  }, [hydrated, user, pathname, tourActive, welcomeVisible, active, foregrounds]);

  if (active === 'premium') return <PremiumNudge />;
  if (active === 'notifications') return <NotificationNudge />;
  return null;
}

function NudgeCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const dismiss = useNudgeStore((s) => s.dismiss);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
            <Ionicons name={icon} size={28} color={colors.onAccent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Highlights({ items }: { items: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.s2, width: '100%' }}>
      {items.map((item) => (
        <View key={item.text} style={styles.row}>
          <Ionicons name={item.icon} size={20} color={colors.accent} />
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, flex: 1 }}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

function PremiumNudge() {
  const { colors } = useTheme();
  const router = useRouter();
  const dismiss = useNudgeStore((s) => s.dismiss);
  const [offer, setOffer] = useState<PremiumOfferCopy | null>(null);
  const [loading, setLoading] = useState(billingAvailable());

  useEffect(() => {
    if (!billingAvailable()) return;
    let cancelled = false;
    getPremiumOffering().then((offering) => {
      if (cancelled) return;
      setOffer(premiumOfferCopy(offering));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const seePlans = () => {
    dismiss();
    router.push('/premium');
  };

  return (
    <NudgeCard
      icon="star"
      title="Get more from your money"
      body="Premium turns your expenses into answers — and pays for itself once it spots one wasted subscription."
    >
      <Highlights
        items={[
          { icon: 'chatbubbles-outline', text: 'Unlimited AI advisor' },
          { icon: 'receipt-outline', text: 'Receipt scanning & imports' },
          { icon: 'analytics-outline', text: 'Deeper insights & full history' },
        ]}
      />
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : offer?.headline ? (
        <View style={[styles.pricePill, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.price, { color: colors.textPrimary }]}>{offer.headline}</Text>
          {offer.trial ? (
            <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
              {offer.trial}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button title={offer?.trial ? 'Start free trial' : 'See Premium plans'} size="lg" onPress={seePlans} />
        <Button title="Not now" variant="outline" size="lg" onPress={dismiss} />
      </View>
    </NudgeCard>
  );
}

function NotificationNudge() {
  const dismiss = useNudgeStore((s) => s.dismiss);
  const [permission, setPermission] = useState<PermissionDetails | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    getPermissionDetails().then(setPermission);
  }, []);

  // Android stops showing its dialog after repeated denials — only settings can re-enable.
  const needsSettings = !!permission && permission.status !== 'granted' && !permission.canAskAgain;

  const turnOn = async () => {
    if (needsSettings) {
      dismiss();
      void Linking.openSettings(); // registration is picked up when the app comes back
      return;
    }
    setWorking(true);
    try {
      await ensureAndroidChannel(); // Android 13+ shows no prompt without a channel
      const outcome = await requestPermission(true);
      if (outcome === 'granted') {
        const ok = await registerThisDeviceForPush();
        if (ok) toast.success('Notifications are on');
        else toast.error('Notifications allowed, but this device could not be registered. Try again later.');
      } else if (outcome === 'denied') {
        toast.info('No problem — you can turn them on anytime in Profile → Notifications.');
      }
    } finally {
      setWorking(false);
      dismiss();
    }
  };

  return (
    <NudgeCard
      icon="notifications"
      title="Don't miss what matters"
      body="Notifications are off, so you won't hear about budget alerts or your daily logging reminder."
    >
      <Highlights
        items={[
          { icon: 'alert-circle-outline', text: 'Heads-up before you overspend' },
          { icon: 'time-outline', text: 'A gentle daily reminder to log' },
          { icon: 'sparkles-outline', text: 'New insights as they arrive' },
        ]}
      />
      <View style={styles.actions}>
        <Button
          title={needsSettings ? 'Open settings' : 'Turn on notifications'}
          size="lg"
          loading={working}
          disabled={!permission}
          onPress={() => void turnOn()}
        />
        <Button title="Not now" variant="outline" size="lg" onPress={dismiss} disabled={working} />
      </View>
    </NudgeCard>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.s5,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.s5,
    alignItems: 'center',
    gap: spacing.s3,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
  pricePill: {
    width: '100%',
    borderRadius: radius.md,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    alignItems: 'center',
    gap: 2,
  },
  price: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.s2,
    marginTop: spacing.s2,
  },
});
