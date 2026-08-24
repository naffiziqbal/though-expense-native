import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectSheetProps {
  label?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
}

/** A dropdown-style field that opens a bottom sheet of options (native select). */
export function SelectSheet({ label, value, options, onChange, placeholder = 'Select…', title }: SelectSheetProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ gap: spacing.s1 }}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      >
        <Text style={{ color: selected ? colors.textPrimary : colors.textMuted, fontSize: fontSize.md }}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title || label || 'Select'}>
        <View style={{ gap: spacing.s1 }}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[
                  styles.option,
                  { backgroundColor: isSelected ? colors.accentSoft : 'transparent' },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.accent : colors.textPrimary,
                    fontSize: fontSize.md,
                    fontFamily: isSelected ? fonts.semibold : fonts.regular,
                  }}
                >
                  {option.label}
                </Text>
                {isSelected ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  option: {
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s3,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
