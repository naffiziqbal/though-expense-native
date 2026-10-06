import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getIso4217Currency } from '../../lib/currencies';
import { BottomSheet } from '../ui/BottomSheet';
import { CurrencySearchPanel } from './CurrencySearchPanel';

interface CurrencyPickerFieldProps {
  label?: string;
  value: string;
  onChange: (code: string) => void;
  title?: string;
  hint?: string;
}

export function CurrencyPickerField({
  label,
  value,
  onChange,
  title = 'Select currency',
  hint,
}: CurrencyPickerFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = getIso4217Currency(value);

  return (
    <View style={{ gap: spacing.s1 }}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      >
        <Text style={{ color: selected ? colors.textPrimary : colors.textMuted, fontSize: fontSize.md, flex: 1 }}>
          {selected ? `${selected.code} — ${selected.name}` : 'Select currency'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {hint ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.s1 }}>
          {hint}
        </Text>
      ) : null}
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
      >
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <CurrencySearchPanel
            selectedCode={value}
            onSelect={(code) => {
              onChange(code);
              setOpen(false);
            }}
          />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
