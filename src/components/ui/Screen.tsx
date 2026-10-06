import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTabScreenTopPadding } from '../../hooks/useSafeTop';
import { useTheme } from '../../hooks/useTheme';
import { useKeyboardLift } from './KeyboardSpacer';

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
  const tabTopPadding = useTabScreenTopPadding();
  const { height: windowHeight } = useWindowDimensions();
  /** Scrolls with content — always clear the status bar; tab screens skip extra s4. */
  const paddingTop = safeTop ? tabTopPadding : tabTopPadding + spacing.s4;

  const lift = useKeyboardLift(insets.bottom);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  // Scroll views only: when the keyboard opens, make sure the focused input
  // isn't left underneath it (the spacer adds room; this moves the viewport).
  useEffect(() => {
    if (!scroll) return;
    const sub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        const input = TextInput.State.currentlyFocusedInput?.();
        if (!input || !scrollRef.current) return;
        // Wait a frame so the spacer height applies before measuring.
        requestAnimationFrame(() => {
          input.measureInWindow((_x, y, _w, h) => {
            const keyboardTop = windowHeight - (e.endCoordinates?.height ?? 0);
            const overlap = y + h + spacing.s6 - keyboardTop;
            if (overlap > 0) {
              scrollRef.current?.scrollTo({ y: scrollOffset.current + overlap, animated: true });
            }
          });
        });
      }
    );
    return () => sub.remove();
  }, [scroll, windowHeight]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = e.nativeEvent.contentOffset.y;
  };

  const inner = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        safeTop ? styles.contentTab : styles.content,
        {
          paddingTop,
          // Tab scenes already sit above the tab bar — only a little scroll end padding.
          paddingBottom: safeTop ? spacing.s3 : spacing.s8 + insets.bottom,
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
    >
      {children}
      {/* Keyboard spacer: grows to the keyboard height so everything stays reachable */}
      <Animated.View style={{ height: lift }} />
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>
      <View style={[safeTop ? styles.contentTab : styles.content, { flex: 1, paddingTop }, contentStyle]}>
        {children}
      </View>
      {/* Keyboard spacer: pushes pinned bottom content (e.g. chat input) above the keyboard */}
      <Animated.View style={{ height: lift }} />
    </View>
  );

  return <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>{inner}</View>;
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.s4,
    gap: spacing.s4,
  },
  contentTab: {
    paddingHorizontal: spacing.s4,
    gap: spacing.s3,
  },
});
