import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface Segment {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ segments, value, onChange }: SegmentedControlProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}
          >
            <Text
              style={{
                color: active ? colors.onAccent : colors.textSecondary,
                fontFamily: active ? fonts.semibold : fonts.medium,
                fontSize: fontSize.sm,
              }}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.s2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
});
