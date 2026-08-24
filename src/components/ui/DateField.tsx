import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface DateFieldProps {
  label?: string;
  /** ISO date string YYYY-MM-DD (empty string = unset) */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Allow clearing back to empty */
  clearable?: boolean;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateField({ label, value, onChange, placeholder = 'Select date', minimumDate, maximumDate, clearable }: DateFieldProps) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const dateValue = value ? new Date(`${value}T12:00:00`) : new Date();

  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) onChange(toISO(date));
  };

  return (
    <View style={{ gap: spacing.s1 }}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      >
        <Text style={{ color: value ? colors.textPrimary : colors.textMuted, fontSize: fontSize.md }}>
          {value || placeholder}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
          {clearable && value ? (
            <Pressable hitSlop={8} onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </View>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)} title={label || 'Select date'}>
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, date) => {
              if (date) onChange(toISO(date));
            }}
          />
          <Button title="Done" onPress={() => setOpen(false)} />
        </BottomSheet>
      ) : null}
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
});
