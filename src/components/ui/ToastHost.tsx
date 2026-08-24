import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useToastStore } from '../../store/toastStore';

export function ToastHost() {
  const { message, type, hide } = useToastStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!message) return null;

  const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';
  const iconColor = type === 'success' ? colors.success : type === 'error' ? colors.error : colors.accent;

  return (
    <Pressable
      onPress={hide}
      style={[
        styles.toast,
        {
          top: insets.top + spacing.s2,
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={[styles.text, { color: colors.textPrimary }]} numberOfLines={3}>
        {message}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.s4,
    right: spacing.s4,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    padding: spacing.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
});
