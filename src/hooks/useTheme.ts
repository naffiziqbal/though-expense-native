import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from '../constants/theme';
import { useThemeStore } from '../store/themeStore';

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
