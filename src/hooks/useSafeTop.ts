import Constants from 'expo-constants';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../constants/theme';

/** Reliable in Expo Go and dev builds (not only `StatusBar.currentHeight`). */
export function getStatusBarHeight(): number {
  const fromExpo = Constants.statusBarHeight ?? 0;
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? fromExpo;
  }
  return fromExpo;
}

/** Fallback when edge-to-edge reports 0 before first layout. */
const ANDROID_MIN_TOP_INSET = 28;

/**
 * Top inset for content below the status bar. Android edge-to-edge may report
 * `insets.top` or only `StatusBar.currentHeight` — use whichever is larger.
 */
export function resolveTabTopInset(insetsTop: number): number {
  if (Platform.OS === 'android') {
    const statusH = getStatusBarHeight();
    const resolved = Math.max(statusH, insetsTop);
    if (resolved > 0) return resolved;
    return ANDROID_MIN_TOP_INSET;
  }
  return insetsTop;
}

/** Status bar / notch inset. Falls back on Android when edge-to-edge reports 0. */
export function useSafeTop() {
  const insets = useSafeAreaInsets();
  return resolveTabTopInset(insets.top);
}

/** Top padding for headerless tab screens — full inset plus a little air on Android. */
export function useTabScreenTopPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  const full = resolveTabTopInset(insets.top);
  const breath = Platform.OS === 'android' ? spacing.s2 : 0;
  return full + breath + extra;
}
