import Constants from 'expo-constants';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Reliable in Expo Go and dev builds (not only `StatusBar.currentHeight`). */
export function getStatusBarHeight(): number {
  const fromExpo = Constants.statusBarHeight ?? 0;
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? fromExpo;
  }
  return fromExpo;
}

/**
 * Top inset for tab content. On Android, never use inflated `insets.top` — only the
 * status bar height (translucent bar in app.json).
 */
export function resolveTabTopInset(insetsTop: number): number {
  if (Platform.OS === 'android') {
    const statusH = getStatusBarHeight();
    if (statusH > 0) return statusH;
    return Math.min(insetsTop, 36);
  }
  return insetsTop;
}

/** Status bar / notch inset. Falls back on Android when edge-to-edge reports 0. */
export function useSafeTop() {
  const insets = useSafeAreaInsets();
  return resolveTabTopInset(insets.top);
}

/** Tab screens sit tighter under the status bar (~half the system inset). */
export const TAB_TOP_INSET_RATIO = 0.5;

/** Top padding for headerless tab screens. */
export function useTabScreenTopPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  const full = resolveTabTopInset(insets.top);
  return Math.round(full * TAB_TOP_INSET_RATIO) + extra;
}
