import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding (e.g. above tab bar). Safe-area is always applied. */
  keyboardAvoiding?: boolean;
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  keyboardAvoiding = false,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.s8 + insets.bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.s4,
    gap: spacing.s4,
  },
});
