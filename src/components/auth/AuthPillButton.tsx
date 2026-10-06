import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface AuthPillButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Compact auth submit — pill label + arrow chip. */
export function AuthPillButton({
  label,
  onPress,
  loading,
  loadingLabel,
  disabled,
  accessibilityLabel,
  style,
}: AuthPillButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.accent,
          opacity: inactive ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.onAccent} />
          {loadingLabel ? (
            <Text style={[styles.label, { color: colors.onAccent }]}>{loadingLabel}</Text>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.onAccent }]}>{label}</Text>
          <View style={[styles.arrowChip, { backgroundColor: `${colors.onAccent}22` }]}>
            <Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    paddingVertical: spacing.s2,
    paddingLeft: spacing.s4,
    paddingRight: spacing.s1,
    borderRadius: radius.full,
    minHeight: 40,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    paddingHorizontal: spacing.s3,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.sm,
    letterSpacing: 0.2,
  },
  arrowChip: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
