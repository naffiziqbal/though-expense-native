import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CurrencyChangeConsentSheet } from '../../components/currency/CurrencyChangeConsentSheet';
import { CurrencySearchPanel } from '../../components/currency/CurrencySearchPanel';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { CURRENCY_DISPLAY_HINT, findCurrency } from '../../lib/currencies';
import { useScreenBack } from '../../lib/hiddenTabNavigation';
import { formatCurrency } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const PREVIEW_AMOUNT = 12450.75;

export default function CurrenciesScreen() {
  const { colors } = useTheme();
  const goBack = useScreenBack('/(tabs)/profile');
  const { user, setUser } = useAuthStore();
  const savedCode = user?.currency || 'USD';
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selected = useMemo(() => findCurrency(savedCode) ?? findCurrency('USD')!, [savedCode]);
  const preview = formatCurrency(PREVIEW_AMOUNT, selected.code);

  const handlePick = (code: string) => {
    if (code === savedCode) return;
    setPendingCode(code);
    setConsentOpen(true);
  };

  const closeConsent = () => {
    if (isSaving) return;
    setConsentOpen(false);
    setPendingCode(null);
  };

  const applyCurrency = async () => {
    if (!pendingCode || !user || pendingCode === savedCode) return;
    setIsSaving(true);
    try {
      const res = await api.updateProfile({ currency: pendingCode });
      if (res.success && res.data?.user) {
        setUser({ ...user, ...res.data.user });
        toast.success(`Currency updated — amounts now display in ${pendingCode}`);
        setConsentOpen(false);
        setPendingCode(null);
        goBack();
      } else {
        toast.error('Failed to update currency. Please try again.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update currency. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen safeTop contentStyle={{ gap: spacing.s3, paddingBottom: spacing.s6 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Currency</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>ISO 4217 display currency</Text>
        </View>
      </View>

      <View style={[styles.heroCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Display currency</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3, marginTop: spacing.s2 }}>
          <View style={[styles.flagBubble, { backgroundColor: colors.bgPrimary }]}>
            <Text style={{ fontSize: 28 }}>{selected.flag}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>{selected.code}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 }} numberOfLines={1}>
              {selected.name}
            </Text>
          </View>
          <View style={[styles.symbolPill, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>{selected.symbol}</Text>
          </View>
        </View>
        <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 28, marginTop: spacing.s3, letterSpacing: -0.5 }}>
          {preview}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.s1 }}>Example formatting</Text>
      </View>

      <CurrencySearchPanel selectedCode={savedCode} onSelect={handlePick} />

      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, marginHorizontal: spacing.s1 }}>{CURRENCY_DISPLAY_HINT}</Text>

      <CurrencyChangeConsentSheet
        visible={consentOpen}
        pendingCode={pendingCode}
        currentCode={savedCode}
        onConfirm={applyCurrency}
        onCancel={closeConsent}
        loading={isSaving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  backBtn: { marginLeft: -spacing.s1 },
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  flagBubble: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolPill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
  },
});
