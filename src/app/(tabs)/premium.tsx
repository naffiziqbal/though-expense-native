import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, shape, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import { billingAvailable, getPremiumOffering, purchasePremium, restorePurchases } from '../../lib/billing';
import {
  FALLBACK_PLANS,
  PACKAGE_LABELS,
  PACKAGE_SUBTITLES,
  PREMIUM_BENEFITS,
  PREMIUM_PAGE_HINT,
} from '../../lib/premiumDashboard';
import { useScreenBack } from '../../lib/hiddenTabNavigation';
import { premiumPlansSubtitle } from '../../lib/subscription';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

export default function PremiumScreen() {
  const { colors } = useTheme();
  const goBack = useScreenBack('/(tabs)/profile');
  const { user, setUser } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(billingAvailable());
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!billingAvailable() || isPremium) {
      setLoadingOffering(false);
      return;
    }
    (async () => {
      const current = await getPremiumOffering();
      setOffering(current);
      if (current?.availablePackages?.length) {
        setSelectedId(current.availablePackages[0].identifier);
      }
      setLoadingOffering(false);
    })();
  }, [isPremium]);

  const refreshUserFromServer = useCallback(async () => {
    try {
      const response = await api.getCurrentUser();
      if (response.success) setUser(response.data.user);
    } catch {
      // webhook will still update the backend; optimistic state stands
    }
  }, [setUser]);

  const handlePurchase = async () => {
    const pkg = offering?.availablePackages.find((p) => p.identifier === selectedId);
    if (!pkg) return;
    setPurchasing(true);
    try {
      const active = await purchasePremium(pkg);
      if (active) {
        if (user) setUser({ ...user, isPremium: true });
        setTimeout(refreshUserFromServer, 2500);
      }
    } catch (err) {
      const cancelled = !!(err as { userCancelled?: boolean })?.userCancelled;
      if (!cancelled) toast.error('Purchase failed. You were not charged — please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const active = await restorePurchases();
      if (active) {
        if (user) setUser({ ...user, isPremium: true });
        toast.success('Purchases restored!');
        setTimeout(refreshUserFromServer, 2500);
      } else {
        toast.info('No previous purchases found for this account.');
      }
    } catch {
      toast.error('Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const packages = offering?.availablePackages ?? [];
  const paywallReady = billingAvailable() && packages.length > 0;
  const selectedPkg = packages.find((p) => p.identifier === selectedId);
  const isLifetimeSelected = selectedPkg?.packageType === 'LIFETIME';

  const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY');
  const annualPkg = packages.find((p) => p.packageType === 'ANNUAL');
  const yearlySavingsPct =
    monthlyPkg && annualPkg && monthlyPkg.product.price > 0
      ? Math.round((1 - annualPkg.product.price / (monthlyPkg.product.price * 12)) * 100)
      : null;

  const statusLine = isPremium ? premiumPlansSubtitle(user) : PREMIUM_PAGE_HINT;

  return (
    <Screen safeTop contentStyle={{ gap: spacing.s3 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Subscription</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }} numberOfLines={2}>
            {statusLine}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.heroCard,
          {
            borderColor: isPremium ? colors.accent : colors.border,
            backgroundColor: isPremium ? colors.accentSoft : colors.bgCard,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
          <View style={[styles.starBubble, { backgroundColor: isPremium ? colors.accent : colors.bgPrimary }]}>
            <Ionicons name="star" size={26} color={isPremium ? colors.onAccent : colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Your plan</Text>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.lg, marginTop: 2 }}>
              {isPremium ? 'Premium' : 'Free'}
            </Text>
            {isPremium && user?.subscription?.summaryLine ? (
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 }} numberOfLines={2}>
                {user.subscription.summaryLine}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{isPremium ? 'Included' : 'Premium includes'}</Text>
      <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        {PREMIUM_BENEFITS.map((b, i) => (
          <View
            key={b.title}
            style={[
              styles.benefitRow,
              i < PREMIUM_BENEFITS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>{b.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 }}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {!isPremium && paywallReady ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Choose a plan</Text>
          <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard, gap: spacing.s2, padding: spacing.s3 }]}>
            {packages.map((pkg: PurchasesPackage) => {
              const selected = pkg.identifier === selectedId;
              const subtitle = PACKAGE_SUBTITLES[pkg.packageType];
              const badge =
                pkg.packageType === 'ANNUAL' && yearlySavingsPct && yearlySavingsPct > 0
                  ? `SAVE ${yearlySavingsPct}%`
                  : pkg.packageType === 'LIFETIME'
                    ? 'BEST VALUE'
                    : null;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelectedId(pkg.identifier)}
                  style={[
                    styles.planRow,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accentSoft : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selected ? colors.accent : colors.border },
                      selected && { backgroundColor: colors.accent },
                    ]}
                  >
                    {selected ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2, flexWrap: 'wrap' }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                        {PACKAGE_LABELS[pkg.packageType] ?? pkg.product.title}
                      </Text>
                      {badge ? (
                        <View style={[styles.saveBadge, { backgroundColor: colors.accent }]}>
                          <Text style={{ color: colors.onAccent, fontSize: 10, fontFamily: fonts.bold }}>{badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    {subtitle ? <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{subtitle}</Text> : null}
                  </View>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                    {pkg.product.priceString}
                  </Text>
                </Pressable>
              );
            })}
            <Button
              title={isLifetimeSelected ? 'Get lifetime access' : 'Subscribe'}
              size="lg"
              onPress={handlePurchase}
              loading={purchasing}
              disabled={!selectedId}
              style={{ marginTop: spacing.s1 }}
            />
            <Pressable onPress={handleRestore} disabled={restoring} style={{ alignSelf: 'center', paddingVertical: spacing.s1 }}>
              <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 16 }}>
              {isLifetimeSelected
                ? `One-time payment through ${storeName}. No renewals.`
                : `Billed through ${storeName}. Renews automatically — cancel anytime in store settings.`}
            </Text>
          </View>
        </>
      ) : null}

      {!isPremium && !paywallReady ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Plans</Text>
          <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard, padding: spacing.s3, gap: spacing.s2 }]}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>
              {loadingOffering ? 'Loading plans…' : 'Preview pricing'}
            </Text>
            {!loadingOffering
              ? FALLBACK_PLANS.map((plan) => (
                  <View key={plan.id} style={[styles.planRow, { borderColor: colors.border, backgroundColor: 'transparent' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>{plan.label}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{plan.subtitle}</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>{plan.price}</Text>
                  </View>
                ))
              : null}
            {!loadingOffering ? (
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 18 }}>
                Purchasing isn&apos;t available on this build yet. Use a store build to subscribe.
              </Text>
            ) : null}
          </View>
        </>
      ) : null}

      {isPremium ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, marginHorizontal: spacing.s1 }}>
          Manage or cancel your subscription in {storeName} account settings. Your Premium perks stay active until the
          period ends.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  backBtn: { marginLeft: -spacing.s1, marginTop: 2 },
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  starBubble: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    marginLeft: spacing.s1,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  benefitRow: {
    flexDirection: 'row',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    minHeight: 52,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: shape.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
  },
});
