import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getImageUrl } from '../../lib/utils';
import { premiumPlansSubtitle } from '../../lib/subscription';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  href?: Href;
  comingSoon?: boolean;
  onPress?: () => void;
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const startTour = useOnboardingStore((s) => s.start);
  const isPremium = user?.isPremium ?? false;
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const avatarUrl = getImageUrl(user?.profilePicture || user?.profilePictureUrl);

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'GENERAL',
      items: [
        { icon: 'person', iconColor: '#2563EB', title: 'Edit Profile', subtitle: 'Update name & avatar', href: '/profile-edit' },
        {
          icon: 'star',
          iconColor: '#EA580C',
          title: 'Premium Plans',
          subtitle: premiumPlansSubtitle(user),
          href: '/premium',
        },
      ],
    },
    {
      title: 'APP SETTINGS',
      items: [
        { icon: 'notifications', iconColor: '#DB2777', title: 'Notifications', subtitle: 'Alerts & daily reminder', href: '/notifications' },
        { icon: 'repeat', iconColor: '#0284C7', title: 'Recurring', subtitle: 'Auto-log subscriptions & bills', href: '/recurring' },
        { icon: 'wallet', iconColor: '#9333EA', title: 'Accounts', subtitle: 'Manage bank & cash', comingSoon: true },
        { icon: 'phone-portrait', iconColor: '#475569', title: 'Device Settings', subtitle: 'Dark mode & appearance', href: '/device-settings' },
        { icon: 'globe', iconColor: '#4F46E5', title: 'Currencies', subtitle: `${user?.currency || 'USD'} and more`, href: '/currencies' },
        { icon: 'pie-chart', iconColor: '#0EA5A4', title: 'Monthly Budget', subtitle: 'Set limits & category budgets', href: '/budget' },
        { icon: 'flag', iconColor: '#16A34A', title: 'Savings Goals', subtitle: 'Set targets & track progress', href: '/goals' },
        { icon: 'sparkles', iconColor: '#D97706', title: 'AI Advisor', subtitle: 'Ask anything about your money', href: '/assistant' },
        {
          icon: 'help-buoy',
          iconColor: '#0D9488',
          title: 'Replay the tour',
          subtitle: 'Let Penny walk you through it again',
          // The overlay navigates to each step's screen itself.
          onPress: startTour,
        },
      ],
    },
    {
      title: 'SECURITY',
      items: [{ icon: 'shield-checkmark', iconColor: '#059669', title: 'Security', subtitle: 'Change password', href: '/security' }],
    },
  ];

  return (
    <Screen safeTop>
      {/* Island header */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing.s6 }}>
        <Pressable onPress={() => setLogoutConfirm(true)} style={styles.logoutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
        </Pressable>
        <View style={{ marginBottom: spacing.s3 }}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.avatarInitial}>
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.planBadge,
              { backgroundColor: isPremium ? (isDark ? 'rgba(220, 170, 40, 0.25)' : '#FEF3C7') : colors.border },
            ]}
          >
            <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: isPremium ? (isDark ? '#E8C866' : '#92400E') : colors.textSecondary }}>
              {isPremium ? 'PREMIUM' : 'FREE'}
            </Text>
          </View>
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontFamily: fonts.bold }}>
          {user?.name || 'User'}
        </Text>
        {isPremium && user?.subscription?.summaryLine ? (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.s2, textAlign: 'center' }}>
            {user.subscription.summaryLine}
          </Text>
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 }}>
          ID: {user?.id?.slice(0, 8).toUpperCase()}
        </Text>
      </Card>

      {/* Menu sections */}
      {sections.map((section) => (
        <View key={section.title} style={{ gap: spacing.s2 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.semibold, letterSpacing: 1 }}>
            {section.title}
          </Text>
          <Card padded={false}>
            {section.items.map((item, i) => (
              <Pressable
                key={item.title}
                onPress={() => {
                  if (item.comingSoon) setComingSoon(item.title);
                  else if (item.onPress) item.onPress();
                  else if (item.href) router.push(item.href);
                }}
                style={[
                  styles.menuRow,
                  i < section.items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.iconColor}1A` }]}>
                  <Ionicons name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>{item.title}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}

      {/* Coming soon sheet */}
      <BottomSheet visible={!!comingSoon} onClose={() => setComingSoon(null)} title={comingSoon ? `${comingSoon} — Coming soon!` : ''}>
        <View style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textSecondary }}>This feature is under development. Check back soon!</Text>
          <Button title="OK" onPress={() => setComingSoon(null)} />
        </View>
      </BottomSheet>

      {/* Logout confirmation */}
      <BottomSheet visible={logoutConfirm} onClose={() => setLogoutConfirm(false)} title="Log out?">
        <View style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textSecondary }}>You’ll need to sign in again to access your expenses.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setLogoutConfirm(false)} />
            <Button
              title="Log out"
              variant="danger"
              style={{ flex: 1 }}
              onPress={async () => {
                setLogoutConfirm(false);
                await logout();
                router.replace('/(auth)/login');
              }}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    position: 'absolute',
    top: spacing.s3,
    right: spacing.s3,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  planBadge: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    minHeight: 64,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
