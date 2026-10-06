import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  rightElement?: React.ReactNode;
  variant?: 'filled' | 'underline';
}

export function Input({
  label,
  error,
  hint,
  containerStyle,
  rightElement,
  variant = 'filled',
  style,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const underline = variant === 'underline';
  const borderColor = error ? colors.error : focused ? colors.accent : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          underline && styles.inputWrapUnderline,
          underline
            ? {
                backgroundColor: 'transparent',
                borderBottomColor: borderColor,
              }
            : {
                backgroundColor: colors.inputBg,
                borderColor,
              },
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, underline && styles.inputUnderline, { color: colors.textPrimary }, style]}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={[styles.hint, { color: colors.error }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.s1,
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s3,
  },
  inputWrapUnderline: {
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 0,
    paddingHorizontal: 0,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.s3,
    fontSize: fontSize.md,
  },
  inputUnderline: {
    paddingVertical: spacing.s2,
  },
  hint: {
    fontSize: fontSize.xs,
  },
});
