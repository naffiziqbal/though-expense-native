import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Status bar / notch inset. Falls back on Android when edge-to-edge reports 0. */
export function useSafeTop() {
  const insets = useSafeAreaInsets();
  const fallback = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  return Math.max(insets.top, fallback);
}
