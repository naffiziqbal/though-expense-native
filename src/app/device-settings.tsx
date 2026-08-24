import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, API_BASE_URL } from '../lib/api';
import { toast } from '../store/toastStore';
import { useThemeStore, type ThemeMode } from '../store/themeStore';

const OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'phone-portrait' },
];

export default function DeviceSettingsScreen() {
  const { colors } = useTheme();
  const { mode, setMode } = useThemeStore();
  const [serverUrl, setServerUrl] = useState(api.getBaseUrl());
  const [saving, setSaving] = useState(false);

  const handleSaveServer = async () => {
    const cleaned = serverUrl.trim().replace(/\/+$/, '');
    if (cleaned && !/^https?:\/\//.test(cleaned)) {
      toast.error('URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    await api.setBaseUrl(cleaned || API_BASE_URL);
    setServerUrl(api.getBaseUrl());
    setSaving(false);
    toast.success(`Server set to ${api.getBaseUrl()}`);
  };

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

      <Card padded={false}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>Server</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
            Where the app connects. Default: {API_BASE_URL}
          </Text>
        </View>
        <View style={{ padding: spacing.s3, gap: spacing.s3 }}>
          <Input
            label="API base URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://api.example.com"
            hint="Use your machine's LAN IP (e.g. http://192.168.0.10:7100) during development."
          />
          <Button title="Save server URL" onPress={handleSaveServer} loading={saving} />
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
