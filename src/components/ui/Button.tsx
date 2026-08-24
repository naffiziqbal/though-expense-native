import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
  icon,
}: ButtonProps) {
  const { colors } = useTheme();

  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.error
        : variant === 'secondary'
          ? colors.accentSoft
          : 'transparent';
  const textColor =
    variant === 'primary'
      ? colors.onAccent
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? colors.accent
          : variant === 'outline'
            ? colors.textPrimary
            : colors.accent;
  const borderColor = variant === 'outline' ? colors.border : 'transparent';

  const pad = size === 'sm' ? spacing.s2 : size === 'lg' ? spacing.s4 : spacing.s3;
  const fs = size === 'sm' ? fontSize.sm : size === 'lg' ? fontSize.lg : fontSize.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingVertical: pad,
          paddingHorizontal: pad * 1.5,
          opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: textColor, fontSize: fs }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.s2,
  },
  text: {
    fontWeight: '600',
  },
});
