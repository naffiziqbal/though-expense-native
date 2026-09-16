import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, spacing } from '../../constants/theme';
import { useSafeTop } from '../../hooks/useSafeTop';
import { useTheme } from '../../hooks/useTheme';

interface OfflineBannerProps {
  visible: boolean;
  queuedCount: number;
}

/** Thin strip under the status bar. Reassures rather than warns — saves still work. */
export function OfflineBanner({ visible, queuedCount }: OfflineBannerProps) {
  const { colors } = useTheme();
  const topInset = useSafeTop();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.warningSoft, paddingTop: topInset + spacing.s1 },
      ]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
      <Text style={[styles.text, { color: colors.textPrimary }]}>
        {queuedCount > 0
          ? `Offline — ${queuedCount} save${queuedCount > 1 ? 's' : ''} will sync automatically`
          : 'Offline — your saves will sync automatically'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
    paddingBottom: spacing.s2,
    paddingHorizontal: spacing.s4,
  },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
});
