import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { fonts, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface DonutSlice {
  value: number;
  color: string;
  label?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export function DonutChart({ data, size = 180, strokeWidth = 24, centerLabel, centerSubLabel }: DonutChartProps) {
  const { colors } = useTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const fraction = total > 0 ? d.value / total : 0;
      const dash = fraction * circumference;
      const offset = cumulative * circumference;
      cumulative += fraction;
      return (
        <Circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={d.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          fill="none"
          strokeLinecap="butt"
        />
      );
    });

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {total > 0 ? (
            slices
          ) : (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
          )}
        </G>
      </Svg>
      <View style={[styles.center, { paddingHorizontal: strokeWidth + 6 }]}>
        {centerLabel ? (
          <Text style={[styles.centerLabel, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
            {centerLabel}
          </Text>
        ) : null}
        {centerSubLabel ? (
          <Text style={[styles.centerSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {centerSubLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  centerSub: {
    fontSize: fontSize.xs,
  },
});
