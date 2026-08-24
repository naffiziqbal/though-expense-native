import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { radius } from '../constants/theme';
import { getCategoryIcon } from '../lib/categoryIcons';
import { getCategoryBadgeColors, getCategoryChartColor } from '../lib/utils';

/** Squircle icon bubble used in transaction rows (web parity: colored bg + category icon). */
export function CategoryIconBubble({ category, size = 40 }: { category: string; size?: number }) {
  const { bg } = getCategoryBadgeColors(category);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={getCategoryIcon(category)} size={size * 0.5} color={getCategoryChartColor(category)} />
    </View>
  );
}
