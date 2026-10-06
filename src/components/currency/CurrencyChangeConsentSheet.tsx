import React from 'react';
import { Text, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { fonts, fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { currencyChangeConsentBody, currencyChangeConsentTitle, findCurrency } from '../../lib/currencies';

interface CurrencyChangeConsentSheetProps {
  visible: boolean;
  pendingCode: string | null;
  currentCode: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CurrencyChangeConsentSheet({
  visible,
  pendingCode,
  currentCode,
  onConfirm,
  onCancel,
  loading = false,
}: CurrencyChangeConsentSheetProps) {
  const { colors } = useTheme();
  const pending = pendingCode ? findCurrency(pendingCode) : null;
  if (!pending) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      title={currencyChangeConsentTitle(pending.code)}
    >
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 22 }}>
        {currencyChangeConsentBody(pending.code, pending.name, currentCode)}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.s2, marginTop: spacing.s4 }}>
        <Button title="Cancel" variant="outline" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />
        <Button title="Use this currency" onPress={onConfirm} loading={loading} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}
