import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl({ segments, value, onChange, style }: SegmentedControlProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.bgSurface, borderColor: colors.border }, style]}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
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
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s1,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
});
