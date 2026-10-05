import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  /** Seven daily totals, oldest → newest (today last). */
  values: number[];
};

export function WeekMiniChart({ values }: Props) {
  const { colors, isDark } = useTheme();
  const max = useMemo(() => Math.max(...values, 1), [values]);
  const muted = isDark ? '#37445C' : '#CFE8E4';
  const todayIndex = values.length - 1;

  return (
    <View style={styles.row}>
      {values.map((v, i) => {
        const h = Math.max(4, (v / max) * 38);
        const isToday = i === todayIndex && v > 0;
        return (
          <View key={i} style={[styles.bar, { height: h, backgroundColor: isToday ? colors.accent : muted }]} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 38,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
    minWidth: 8,
  },
});
