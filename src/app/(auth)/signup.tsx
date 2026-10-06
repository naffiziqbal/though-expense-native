import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyPickerField } from '../../components/currency/CurrencyPickerField';
import { AuthPillButton } from '../../components/auth/AuthPillButton';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { getDefaultCurrency } from '../../lib/currencies';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';

function getPasswordStrength(pwd: string): 0 | 1 | 2 | 3 | 4 {
  if (!pwd.length) return 0;
  if (pwd.length < 6) return 1;
  if (pwd.length < 8) return 2;
  if (pwd.length < 10) return 3;
  return 4;
}

const WEBSITE = 'https://thought-expense.nafiziqbal.com';
const compactInput = { paddingVertical: spacing.s2, fontSize: fontSize.sm };

export default function SignupScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const markPending = useOnboardingStore((s) => s.markPending);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState(getDefaultCurrency());
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const isPasswordValid = password.length >= 6;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!email) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Invalid email format';
    if (!password) next.password = 'Password is required';
    else if (password.length < 6) next.password = 'Password must be at least 6 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !isPasswordValid) return;
    setIsLoading(true);
    try {
      const response = await api.signup({
        email,
        password,
        name: name || undefined,
        currency,
      });
      if (response.success) {
        setUser(response.data.user);
        markPending(response.data.user.id);
        toast.success('Account created successfully!');
        router.replace('/(tabs)');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create account. Please try again.'));
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
              Create account
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Thought Expense · natural-language tracking
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <Input
            variant="underline"
            placeholder="Name (optional)"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            autoCapitalize="words"
            style={compactInput}
          />
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
          <View style={{ gap: 4 }}>
            <Input
              variant="underline"
              placeholder="Password (min 6 characters)"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              style={compactInput}
              rightElement={
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                </Pressable>
              }
            />
            {password.length > 0 ? (
              <View style={styles.strengthRow}>
                {[0, 1, 2, 3].map((i) => {
                  let color = colors.border;
                  if (strength === 1 && i === 0) color = colors.error;
                  else if (strength === 2 && i < 2) color = colors.warning;
                  else if (strength === 3 && i < 3) color = colors.warning;
                  else if (strength === 4) color = colors.success;
                  return <View key={i} style={[styles.strengthPill, { backgroundColor: color }]} />;
                })}
              </View>
            ) : null}
          </View>

          <CurrencyPickerField
            compact
            variant="underline"
            value={currency}
            onChange={setCurrency}
            title="Display currency"
          />

          <View style={styles.submitRow}>
            <AuthPillButton
              label="Get started"
              onPress={handleSubmit}
              loading={isLoading}
              loadingLabel="Creating…"
              disabled={!isPasswordValid}
            />
          </View>

          <Text style={[styles.legal, { color: colors.textMuted }]}>
            By signing up you agree to our{' '}
            <Text
              style={[styles.legalLink, { color: colors.textSecondary }]}
              onPress={() => Linking.openURL(`${WEBSITE}/terms`)}
            >
              Terms
            </Text>{' '}
            &{' '}
            <Text
              style={[styles.legalLink, { color: colors.textSecondary }]}
              onPress={() => Linking.openURL(`${WEBSITE}/privacy`)}
            >
              Privacy
            </Text>
            .
          </Text>
        </View>
      </View>

      <View style={[styles.footerRow, { paddingBottom: Math.max(insets.bottom, spacing.s2) }]}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>Sign in</Text>
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
  submitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.s2,
  },
  strengthRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.s1,
  },
  strengthPill: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
  },
  legal: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: spacing.s1,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
