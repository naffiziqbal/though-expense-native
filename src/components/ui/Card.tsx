import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ style, padded = true, children, ...rest }: CardProps) {
  const { colors, isDark } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          padding: padded ? spacing.s4 : 0,
          shadowColor: '#101A26',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: isDark ? 0 : 12,
          elevation: isDark ? 0 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
});
