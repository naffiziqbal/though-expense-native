import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { shape } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getCategoryIcon } from '../lib/categoryIcons';
import { getCategoryBadgeColors, getCategoryChartColor } from '../lib/utils';

/** Squircle icon bubble used in transaction rows; dark mode uses translucent hue tints. */
export function CategoryIconBubble({ category, size = 40 }: { category: string; size?: number }) {
  const { isDark } = useTheme();
  const { bg, text } = getCategoryBadgeColors(category, isDark);
  const iconColor = isDark ? text : getCategoryChartColor(category);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: shape.icon,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={getCategoryIcon(category)} size={size * 0.5} color={iconColor} />
    </View>
  );
}
