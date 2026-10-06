import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPillButton } from '../../components/auth/AuthPillButton';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const compactInput = { paddingVertical: spacing.s2, fontSize: fontSize.sm };

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!email) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Invalid email format';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const response = await api.login({ email, password });
      if (response.success) {
        setUser(response.data.user);
        toast.success('Login successful!');
        router.replace('/(tabs)/add');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Invalid email or password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scroll={false} safeTop contentStyle={styles.screen}>
      <View style={styles.main}>
        <View style={styles.brandRow}>
          <View style={[styles.logo, { backgroundColor: colors.accent }]}>
            <Ionicons name="trending-up" size={20} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Thought Expense · sign in to continue
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <Input
            variant="underline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={compactInput}
          />
          <Input
            variant="underline"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            style={compactInput}
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
              </Pressable>
            }
          />

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.forgotLink} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>

          <View style={styles.submitRow}>
            <AuthPillButton
              label="Sign in"
              onPress={handleSubmit}
              loading={isLoading}
              loadingLabel="Signing in…"
              disabled={!canSubmit}
            />
          </View>
        </View>
      </View>

      <View style={[styles.footerRow, { paddingBottom: Math.max(insets.bottom, spacing.s2) }]}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>No account? </Text>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>Sign up</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s2,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    gap: spacing.s3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  form: {
    gap: spacing.s2,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -spacing.s1,
  },
  submitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.s2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
