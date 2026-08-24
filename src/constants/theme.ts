/**
 * ThoughtExpense design tokens (ported from client/design-token.md)
 * Semantic tokens with light/dark values.
 */

export const palette = {
  blueGray900: '#0B1220',
  blueGray800: '#111827',
  blueGray700: '#1F2937',
  blueGray600: '#374151',
  blueGray500: '#4B5563',
  blueGray400: '#9CA3AF',
  blueGray300: '#D1D5DB',
  blueGray200: '#E5E7EB',
  blueGray100: '#F3F4F6',
  blueGray50: '#F9FAFB',
  teal600: '#0EA5A4',
  teal500: '#14B8A6',
  teal400: '#2DD4BF',
  green600: '#16A34A',
  orange600: '#D97706',
  red600: '#DC2626',
  white: '#FFFFFF',
};

export interface ThemeColors {
  bgPrimary: string;
  bgSurface: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  warning: string;
  error: string;
  errorSoft: string;
  inputBg: string;
}

export const lightColors: ThemeColors = {
  bgPrimary: palette.blueGray50,
  bgSurface: palette.blueGray50,
  bgCard: palette.white,
  textPrimary: palette.blueGray900,
  textSecondary: palette.blueGray500,
  textMuted: palette.blueGray400,
  border: palette.blueGray200,
  accent: palette.teal600,
  accentHover: palette.teal500,
  accentSoft: '#CCFBF1',
  onAccent: palette.white,
  success: palette.green600,
  warning: palette.orange600,
  error: palette.red600,
  errorSoft: '#FEE2E2',
  inputBg: palette.white,
};

export const darkColors: ThemeColors = {
  bgPrimary: palette.blueGray900,
  bgSurface: palette.blueGray800,
  bgCard: palette.blueGray700,
  textPrimary: palette.blueGray50,
  textSecondary: palette.blueGray300,
  textMuted: palette.blueGray400,
  border: palette.blueGray600,
  accent: palette.teal400,
  accentHover: palette.teal500,
  accentSoft: 'rgba(45, 212, 191, 0.15)',
  onAccent: palette.blueGray900,
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  errorSoft: 'rgba(220, 38, 38, 0.2)',
  inputBg: palette.blueGray800,
};

export const spacing = {
  s0: 0,
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 40,
  s8: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;
