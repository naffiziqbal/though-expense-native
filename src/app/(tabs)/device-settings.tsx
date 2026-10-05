import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore, type ThemeMode } from '../../store/themeStore';

const OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'phone-portrait' },
];

export default function DeviceSettingsScreen() {
  const { colors } = useTheme();
  const { mode, setMode } = useThemeStore();

  return (
    <Screen>
      <Card padded={false}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>Appearance</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
            Choose how the app looks on your device
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {OPTIONS.map((opt) => {
            const active = mode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMode(opt.value)}
                style={[
                  styles.option,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accentSoft : 'transparent',
                  },
                ]}
              >
                <Ionicons name={opt.icon} size={22} color={active ? colors.accent : colors.textMuted} />
                <Text
                  style={{
                    color: active ? colors.textPrimary : colors.textSecondary,
                    fontSize: fontSize.sm,
                    fontFamily: fonts.medium,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.s2,
    padding: spacing.s3,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.s2,
    paddingVertical: spacing.s4,
    borderRadius: radius.md,
    borderWidth: 2,
  },
});
