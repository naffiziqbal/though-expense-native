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
  /** Shorter row for dense forms (e.g. signup). */
  compact?: boolean;
  variant?: 'filled' | 'underline';
}

export function CurrencyPickerField({
  label,
  value,
  onChange,
  title = 'Select currency',
  hint,
  compact = false,
  variant = 'filled',
}: CurrencyPickerFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = getIso4217Currency(value);
  const underline = variant === 'underline';

  return (
    <View style={{ gap: compact ? 0 : spacing.s1 }}>
      {label && !compact ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          compact && styles.fieldCompact,
          underline && styles.fieldUnderline,
          underline
            ? { backgroundColor: 'transparent', borderBottomColor: colors.border }
            : { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        {selected ? (
          <Text style={{ fontSize: compact ? 18 : 22, marginRight: spacing.s2 }}>{selected.flag}</Text>
        ) : null}
        <Text
          style={{
            color: selected ? colors.textPrimary : colors.textMuted,
            fontSize: compact ? fontSize.sm : fontSize.md,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {selected
            ? compact
              ? `Display currency · ${selected.code}`
              : `${selected.code} — ${selected.name}`
            : compact
              ? 'Display currency'
              : 'Select currency'}
        </Text>
        <Ionicons name="chevron-down" size={compact ? 16 : 18} color={colors.textSecondary} />
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
  fieldCompact: {
    paddingVertical: spacing.s2,
  },
  fieldUnderline: {
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 0,
    paddingHorizontal: 0,
  },
});
