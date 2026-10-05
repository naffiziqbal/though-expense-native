/**
 * ThoughtExpense design tokens — "Refined Teal" redesign.
 * Evolution of client/design-token.md: same teal + cool gray family,
 * softer cards, calmer hierarchy, Instrument Sans type.
 */

export const palette = {
  ink900: '#101A26',
  ink700: '#22303C',
  gray500: '#5B6B78',
  gray400: '#8A98A5',
  gray300: '#9AA8B3',
  line200: '#E7EDEE',
  line100: '#EEF3F4',
  mist50: '#F5F8F8',
  teal600: '#0E9488',
  teal700: '#0B7A70',
  teal400: '#2DD4BF',
  tealSoft: '#E3F4F1',
  green600: '#2E8B57',
  orange600: '#D97706',
  red600: '#DC2626',
  white: '#FFFFFF',
  // dark surfaces (aligned with home v3 mock #0A101C / #111A2A)
  night900: '#0A101C',
  night800: '#111A2A',
  night700: '#1A2336',
  night600: '#37445C',
  nightText: '#F2F5F7',
  nightMuted: '#8A94A6',
};

/** Instrument Sans static weights (loaded in app/_layout.tsx). */
export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

export interface ThemeColors {
  bgPrimary: string;
  bgSurface: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  inputBg: string;
}

export const lightColors: ThemeColors = {
  bgPrimary: palette.mist50,
  bgSurface: palette.mist50,
  bgCard: palette.white,
  textPrimary: palette.ink900,
  textSecondary: palette.gray500,
  textMuted: palette.gray400,
  border: palette.line200,
  divider: palette.line100,
  accent: palette.teal600,
  accentHover: palette.teal700,
  accentSoft: palette.tealSoft,
  onAccent: palette.white,
  success: palette.green600,
  warning: palette.orange600,
  warningSoft: '#FDF0DE',
  error: palette.red600,
  errorSoft: '#FEE2E2',
  inputBg: palette.white,
};

export const darkColors: ThemeColors = {
  bgPrimary: palette.night900,
  bgSurface: palette.night900,
  bgCard: palette.night800,
  textPrimary: palette.nightText,
  textSecondary: '#B9C2CE',
  textMuted: palette.nightMuted,
  border: palette.night700,
  divider: palette.night700,
  accent: palette.teal400,
  accentHover: '#5EEAD4',
  accentSoft: 'rgba(45, 212, 191, 0.14)',
  onAccent: palette.night900,
  success: '#4ADE80',
  warning: '#FBBF24',
  warningSoft: 'rgba(217, 119, 6, 0.18)',
  error: '#F87171',
  errorSoft: 'rgba(220, 38, 38, 0.2)',
  inputBg: palette.night800,
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
  sm: 8,
  md: 13,
  lg: 20,
  xl: 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 34,
  /** Home hero total (bulk home-screen preview) */
  hero: 36,
} as const;
