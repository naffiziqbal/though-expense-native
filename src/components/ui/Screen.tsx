import React from 'react';
import { RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pad below the status bar. Use on screens WITHOUT a native header (tab screens). */
  safeTop?: boolean;
  /** Kept for API compatibility — keyboard handling is now always on. */
  keyboardAvoiding?: boolean;
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  safeTop = false,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = safeTop ? insets.top + spacing.s3 : spacing.s4;

  const inner = scroll ? (
    // Keyboard-aware: the focused input always stays above the keyboard.
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      bottomOffset={spacing.s6}
      contentContainerStyle={[
        styles.content,
        { paddingTop, paddingBottom: spacing.s8 + insets.bottom },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={insets.top}>
      <View style={[styles.content, { flex: 1, paddingTop }, contentStyle]}>{children}</View>
    </KeyboardAvoidingView>
  );

  return <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>{inner}</View>;
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.s4,
    gap: spacing.s4,
  },
});
