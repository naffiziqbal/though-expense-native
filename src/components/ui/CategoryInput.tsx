import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Input } from './Input';

interface CategoryInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  label?: string;
  placeholder?: string;
}

/** Free-text category field with tappable suggestion list (RN port of CategoryInput). */
export function CategoryInput({
  value,
  onChange,
  suggestions = [],
  label,
  placeholder = 'Enter or select category',
}: CategoryInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!value) return suggestions;
    return suggestions.filter((c) => c.toLowerCase().includes(value.toLowerCase()));
  }, [value, suggestions]);

  const showSuggestions = focused && filtered.length > 0;

  return (
    <View style={{ gap: spacing.s1 }}>
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        hint={!showSuggestions ? 'Type to create a new category or select from suggestions' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        autoCapitalize="words"
      />
      {showSuggestions ? (
        <View style={[styles.dropdown, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {filtered.slice(0, 6).map((category) => (
            <Pressable
              key={category}
              onPress={() => {
                onChange(category);
                setFocused(false);
              }}
              style={[styles.option, value === category && { backgroundColor: colors.accentSoft }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>{category}</Text>
            </Pressable>
          ))}
          {value && !filtered.includes(value) ? (
            <Text style={[styles.createNew, { color: colors.textSecondary, borderTopColor: colors.border }]}>
              Create new: “{value}”
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  createNew: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    fontSize: fontSize.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
