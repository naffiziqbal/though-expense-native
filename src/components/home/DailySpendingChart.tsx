import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export type DailySpendBucket = {
  key: string;
  label: string;
  amount: number;
};

type Props = {
  buckets: DailySpendBucket[];
  dailyLimit: number;
};

const CHART_HEIGHT = 90;

export function DailySpendingChart({ buckets, dailyLimit }: Props) {
  const { colors, isDark } = useTheme();
  const track = isDark ? '#1C2638' : colors.border;
  const limitLine = isDark ? '#3A4660' : colors.border;
  const overColor = colors.warning;

  const maxAmount = useMemo(() => Math.max(dailyLimit, ...buckets.map((b) => b.amount), 1), [buckets, dailyLimit]);

  const limitFromBottom = dailyLimit > 0 ? (dailyLimit / maxAmount) * CHART_HEIGHT : 0;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bgCard }]}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {dailyLimit > 0 ? (
          <View
            style={[
              styles.limitLine,
              {
                bottom: limitFromBottom,
                borderTopColor: limitLine,
              },
            ]}
          />
        ) : null}
        <View style={styles.bars}>
          {buckets.map((bucket) => {
            const h = (bucket.amount / maxAmount) * CHART_HEIGHT;
            const over = dailyLimit > 0 && bucket.amount > dailyLimit;
            return (
              <View key={bucket.key} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(h, bucket.amount > 0 ? 4 : 2),
                      backgroundColor: over ? overColor : colors.accent,
                      opacity: bucket.amount > 0 && !over ? 1 : bucket.amount > 0 ? 1 : 0.35,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.labels}>
        {buckets.map((bucket) => (
          <Text key={bucket.key} style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
            {bucket.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  chart: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  limitLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  barCol: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 4,
    width: '100%',
  },
  labels: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: fonts.regular,
  },
});
