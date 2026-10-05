import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import { billingAvailable, getPremiumOffering, purchasePremium, restorePurchases } from '../../lib/billing';
import { premiumPlansSubtitle } from '../../lib/subscription';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const benefits = [
  { title: 'Unlimited AI advisor', desc: 'Ask anything about your money — why it changed, how to save' },
  { title: 'Weekly financial briefing', desc: 'Your week in money, with recommendations, by email' },
  { title: 'Smart alerts', desc: 'Anomaly, trend & waste detection over 12 months of history' },
  { title: 'Full expense history', desc: 'Search and analyze all your past transactions' },
  { title: 'Receipt scanning', desc: 'Scan receipts with camera or upload' },
  { title: 'Export (CSV & PDF)', desc: 'Download your data anytime' },
];

const PACKAGE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  ANNUAL: 'Yearly',
  SIX_MONTH: '6 months',
  THREE_MONTH: '3 months',
  WEEKLY: 'Weekly',
  LIFETIME: 'Lifetime',
};

const PACKAGE_SUBTITLES: Record<string, string> = {
  MONTHLY: 'Cancel anytime',
  ANNUAL: 'Best for committed savers',
  LIFETIME: 'One-time payment, yours forever',
};

/** Static tiers shown while store billing is not configured. */
const FALLBACK_PLANS = [
  { id: 'monthly', label: 'Monthly', price: '$6.99/mo', subtitle: 'Cancel anytime' },
  { id: 'yearly', label: 'Yearly', price: '$60/yr', subtitle: 'Save ~28% vs monthly' },
  { id: 'lifetime', label: 'Lifetime', price: '$99', subtitle: 'One-time payment, yours forever' },
];

export default function PremiumScreen() {
  const { colors } = useTheme();
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

  // "Save N%" on the yearly plan, derived from the store's real prices
  const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY');
  const annualPkg = packages.find((p) => p.packageType === 'ANNUAL');
  const yearlySavingsPct =
    monthlyPkg && annualPkg && monthlyPkg.product.price > 0
      ? Math.round((1 - annualPkg.product.price / (monthlyPkg.product.price * 12)) * 100)
      : null;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: spacing.s2 }}>
        <View style={[styles.crown, { backgroundColor: colors.accent }]}>
          <Ionicons name="star" size={30} color={colors.onAccent} />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.xl, fontFamily: fonts.bold }}>
          ThoughtExpense Premium
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
          {isPremium
            ? premiumPlansSubtitle(user)
            : 'Unlock the full power of your expense tracker'}
        </Text>
      </View>

      <Card>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontFamily: fonts.semibold, marginBottom: spacing.s3 }}>
          {isPremium ? 'What you have' : 'What you get'}
        </Text>
        <View style={{ gap: spacing.s3 }}>
          {benefits.map((b) => (
            <View key={b.title} style={{ flexDirection: 'row', gap: spacing.s3 }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium }}>{b.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {!isPremium && paywallReady ? (
        <Card style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>Choose your plan</Text>
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
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : 'transparent' },
                ]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.accent : colors.textMuted}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium }}>
                      {PACKAGE_LABELS[pkg.packageType] ?? pkg.product.title}
                    </Text>
                    {badge ? (
                      <View style={[styles.saveBadge, { backgroundColor: colors.accent }]}>
                        <Text style={{ color: colors.onAccent, fontSize: 10, fontFamily: fonts.bold }}>{badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  {subtitle ? (
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{subtitle}</Text>
                  ) : null}
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>{pkg.product.priceString}</Text>
              </Pressable>
            );
          })}
          <Button
            title={isLifetimeSelected ? 'Get Lifetime Access' : 'Subscribe'}
            size="lg"
            onPress={handlePurchase}
            loading={purchasing}
            disabled={!selectedId}
          />
          <Pressable onPress={handleRestore} disabled={restoring} style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>
            {isLifetimeSelected
              ? 'One-time payment through Google Play. No renewals, ever.'
              : 'Billed through Google Play. Renews automatically — cancel anytime in the Play Store.'}
          </Text>
        </Card>
      ) : null}

      {!isPremium && !paywallReady ? (
        <Card style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>
            {loadingOffering ? 'Loading plans…' : 'Plans'}
          </Text>
          {!loadingOffering ? (
            <>
              {FALLBACK_PLANS.map((plan) => (
                <View key={plan.id} style={[styles.planRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium }}>{plan.label}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{plan.subtitle}</Text>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>{plan.price}</Text>
                </View>
              ))}
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
                Purchasing isn't available on this build yet. Stay tuned!
              </Text>
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  crown: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    minHeight: 52,
  },
  saveBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
  },
});
