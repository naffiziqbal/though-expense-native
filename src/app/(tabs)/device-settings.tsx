import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, shape, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  APPEARANCE_PAGE_HINT,
  THEME_MODE_OPTIONS,
  resolvedAppearanceLabel,
  themeModeLabel,
} from '../../lib/appearanceDashboard';
import { useScreenBack } from '../../lib/hiddenTabNavigation';
import { useThemeStore, type ThemeMode } from '../../store/themeStore';

const MODE_ICONS: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  light: 'sunny',
  dark: 'moon',
  system: 'phone-portrait',
};

export default function DeviceSettingsScreen() {
  const { colors, isDark } = useTheme();
  const goBack = useScreenBack('/(tabs)/profile');
  const { mode, setMode } = useThemeStore();

  return (
    <Screen safeTop contentStyle={{ gap: spacing.s3 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Appearance</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{APPEARANCE_PAGE_HINT}</Text>
        </View>
      </View>

      <View style={[styles.previewCard, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
          <View style={[styles.previewIcon, { backgroundColor: colors.bgCard }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={26} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Currently showing</Text>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.lg, marginTop: 2 }}>
              {resolvedAppearanceLabel(mode, isDark)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
              Preference: {themeModeLabel(mode)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Theme</Text>
      <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        {THEME_MODE_OPTIONS.map((opt, i) => {
          const active = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setMode(opt.value)}
              style={[
                styles.row,
                active && { backgroundColor: colors.accentSoft },
                i < THEME_MODE_OPTIONS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.bgPrimary }]}>
                <Ionicons name={MODE_ICONS[opt.value]} size={20} color={active ? colors.accent : colors.textMuted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>{opt.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{opt.description}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  { borderColor: active ? colors.accent : colors.border },
                  active && { backgroundColor: colors.accent },
                ]}
              >
                {active ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  backBtn: { marginLeft: -spacing.s1, marginTop: 2 },
  previewCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    marginLeft: spacing.s1,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: shape.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
