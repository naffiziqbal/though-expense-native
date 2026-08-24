import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';
import { billingAvailable, getPremiumOffering, purchasePremium, restorePurchases } from '../lib/billing';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

const benefits = [
  { title: 'No ads', desc: 'Clean, distraction-free experience' },
  { title: 'Receipt scanning', desc: 'Scan receipts with camera or upload' },
  { title: 'Full expense history', desc: 'Access all your past transactions' },
  { title: 'Export (CSV & PDF)', desc: 'Download your data anytime' },
  { title: 'Daily & Weekly insights', desc: 'Granular AI spending analysis' },
];

const PACKAGE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  ANNUAL: 'Yearly',
  SIX_MONTH: '6 months',
  THREE_MONTH: '3 months',
  WEEKLY: 'Weekly',
  LIFETIME: 'Lifetime',
};

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
        toast.success('Welcome to Premium!');
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
            ? "You're a Premium member. Enjoy all features!"
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
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, flex: 1 }}>
                  {PACKAGE_LABELS[pkg.packageType] ?? pkg.product.title}
                </Text>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>{pkg.product.priceString}</Text>
              </Pressable>
            );
          })}
          <Button title="Subscribe" size="lg" onPress={handlePurchase} loading={purchasing} disabled={!selectedId} />
          <Pressable onPress={handleRestore} disabled={restoring} style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>
            Billed through Google Play. Renews automatically — cancel anytime in the Play Store.
          </Text>
        </Card>
      ) : null}

      {!isPremium && !paywallReady ? (
        <Card style={{ alignItems: 'center', gap: spacing.s2 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>
            {loadingOffering ? 'Loading plans…' : 'Ready to upgrade?'}
          </Text>
          {!loadingOffering ? (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
              Subscriptions aren't available just yet. Stay tuned!
            </Text>
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
});
