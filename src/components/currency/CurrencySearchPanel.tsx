import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { listIso4217CurrenciesGrouped, searchIso4217Currencies } from '../../lib/currencies';
import { CurrencyPickerList } from './CurrencyPickerList';

interface CurrencySearchPanelProps {
  selectedCode: string;
  onSelect: (code: string) => void;
}

export function CurrencySearchPanel({ selectedCode, onSelect }: CurrencySearchPanelProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const { popular, rest, searching } = useMemo(() => {
    const q = query.trim();
    if (q) {
      return { popular: searchIso4217Currencies(q), rest: [], searching: true };
    }
    const grouped = listIso4217CurrenciesGrouped();
    return { popular: grouped.popular, rest: grouped.all, searching: false };
  }, [query]);

  return (
    <View style={{ gap: spacing.s2 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search ISO code or currency name…"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[
          styles.search,
          { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textPrimary },
        ]}
      />
      {!searching && popular.length > 0 ? (
        <>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium, marginLeft: spacing.s1 }}>
            POPULAR
          </Text>
          <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <CurrencyPickerList items={popular} selectedCode={selectedCode} onSelect={onSelect} />
          </View>
        </>
      ) : null}
      {!searching ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium, marginLeft: spacing.s1 }}>
          ALL ISO 4217
        </Text>
      ) : null}
      <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <CurrencyPickerList items={searching ? popular : rest} selectedCode={selectedCode} onSelect={onSelect} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    fontSize: fontSize.sm,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
