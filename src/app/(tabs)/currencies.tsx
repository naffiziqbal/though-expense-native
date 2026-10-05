import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CurrencySearchPanel } from '../../components/currency/CurrencySearchPanel';
import { Button } from '../../components/ui/Button';
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
  const [selectedCurrency, setSelectedCurrency] = useState(savedCode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedCurrency(savedCode);
  }, [savedCode]);

  const hasChanges = selectedCurrency !== savedCode;
  const selected = useMemo(() => findCurrency(selectedCurrency) ?? findCurrency('USD')!, [selectedCurrency]);
  const preview = formatCurrency(PREVIEW_AMOUNT, selected.code);

  const handleSave = async () => {
    if (!hasChanges || !user) return;
    setIsSaving(true);
    try {
      const res = await api.updateProfile({ currency: selectedCurrency });
      if (res.success && res.data?.user) {
        setUser({ ...user, ...res.data.user });
        toast.success(`Currency updated — amounts now display in ${selectedCurrency}`);
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
    <Screen safeTop contentStyle={{ gap: spacing.s3 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Currency</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>ISO 4217 display currency</Text>
        </View>
      </View>

      <View
        style={[
          styles.heroCard,
          {
            borderColor: hasChanges ? colors.accent : colors.border,
            backgroundColor: hasChanges ? colors.accentSoft : colors.bgCard,
          },
        ]}
      >
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
        {hasChanges ? (
          <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium, marginTop: spacing.s2 }}>
            Save to apply this currency
          </Text>
        ) : null}
      </View>

      <CurrencySearchPanel selectedCode={selectedCurrency} onSelect={setSelectedCurrency} />

      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, marginHorizontal: spacing.s1 }}>{CURRENCY_DISPLAY_HINT}</Text>

      <Button title={hasChanges ? 'Save currency' : 'Saved'} size="lg" onPress={handleSave} loading={isSaving} disabled={!hasChanges} />
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
