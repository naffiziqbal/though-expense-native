import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getIso4217Currency, listIso4217CurrenciesGrouped, searchIso4217Currencies } from '../../lib/currencies';
import { BottomSheet } from '../ui/BottomSheet';
import { CurrencyPickerList } from './CurrencyPickerList';

interface CurrencyPickerFieldProps {
  label?: string;
  value: string;
  onChange: (code: string) => void;
  title?: string;
}

export function CurrencyPickerField({ label, value, onChange, title = 'Select currency' }: CurrencyPickerFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = getIso4217Currency(value);

  const sheetItems = useMemo(() => {
    if (query.trim()) return searchIso4217Currencies(query);
    const { popular, all } = listIso4217CurrenciesGrouped();
    return [...popular, ...all];
  }, [query]);

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
      <BottomSheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setQuery('');
        }}
        title={title}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by code or name…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[
            styles.search,
            { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textPrimary },
          ]}
        />
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          <CurrencyPickerList
            items={sheetItems}
            selectedCode={value}
            onSelect={(code) => {
              onChange(code);
              setOpen(false);
              setQuery('');
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
  search: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    fontSize: fontSize.sm,
    marginBottom: spacing.s2,
  },
});
