import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import type { Iso4217Currency } from '../../lib/iso4217';

interface CurrencyPickerListProps {
  items: Iso4217Currency[];
  selectedCode: string;
  onSelect: (code: string) => void;
  maxHeight?: number;
}

export function CurrencyPickerList({ items, selectedCode, onSelect, maxHeight }: CurrencyPickerListProps) {
  const { colors } = useTheme();

  return (
    <View style={maxHeight ? { maxHeight } : undefined}>
      {items.map((currency, i) => {
        const active = selectedCode === currency.code;
        return (
          <Pressable
            key={currency.code}
            onPress={() => onSelect(currency.code)}
            style={[
              styles.row,
              active && { backgroundColor: colors.accentSoft },
              i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.flagBubble, { backgroundColor: colors.bgPrimary }]}>
              <Text style={{ fontSize: 20 }}>{currency.flag}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>{currency.code}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }} numberOfLines={1}>
                {currency.name}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginRight: spacing.s2 }}>{currency.symbol}</Text>
            <View
              style={[
                styles.radio,
                { borderColor: active ? colors.accent : colors.border },
                active && { backgroundColor: colors.accent },
              ]}
            >
              {active ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  flagBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
