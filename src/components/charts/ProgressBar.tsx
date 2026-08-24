import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ProgressBarProps {
  /** 0-100 (values over 100 are clamped visually but colored as over-limit) */
  percentage: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ percentage, color, height = 8 }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, percentage));
  const barColor =
    color || (percentage >= 100 ? colors.error : percentage >= 90 ? colors.warning : colors.accent);
  return (
    <View style={[styles.track, { backgroundColor: colors.border, height, borderRadius: radius.full }]}>
      <View
        style={{
          width: `${clamped}%`,
          backgroundColor: barColor,
          height,
          borderRadius: radius.full,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
});
