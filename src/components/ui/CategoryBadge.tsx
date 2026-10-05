import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getCategoryBadgeColors } from '../../lib/utils';

export function CategoryBadge({ category }: { category: string }) {
  const { isDark } = useTheme();
  const { bg, text } = getCategoryBadgeColors(category, isDark);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]} numberOfLines={1} ellipsizeMode="tail">
        {category}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    maxWidth: 120,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
});
