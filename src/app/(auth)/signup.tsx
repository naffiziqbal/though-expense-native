import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { CURRENCIES, getDefaultCurrency } from '../../lib/currencies';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

function getPasswordStrength(pwd: string): 0 | 1 | 2 | 3 | 4 {
  if (!pwd.length) return 0;
  if (pwd.length < 6) return 1;
  if (pwd.length < 8) return 2;
  if (pwd.length < 10) return 3;
  return 4;
}

const WEBSITE = 'https://thoughtexpense.nafiziqbal.com';

export default function SignupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState(getDefaultCurrency());
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const isPasswordValid = password.length >= 6;

  const strengthColors = [colors.border, colors.error, colors.warning, colors.warning, colors.success];

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
        toast.success('Account created successfully!');
        router.replace('/(tabs)/add');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create account. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentStyle={styles.content}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Ionicons name="trending-up" size={24} color={colors.onAccent} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Start tracking expenses naturally</Text>
      </View>

      <View style={{ gap: spacing.s3 }}>
        <Input placeholder="Full Name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" />
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <View style={{ gap: spacing.s1 }}>
          <Input
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
              </Pressable>
            }
          />
          {/* Strength meter - 4 pills */}
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
        </View>

        <SelectSheet
          value={currency}
          options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
          onChange={setCurrency}
          title="Select Currency"
        />

        <Button title="Get Started" onPress={handleSubmit} loading={isLoading} disabled={!isPasswordValid} size="lg" />

        <Text style={[styles.legal, { color: colors.textSecondary }]}>
          By signing up, you agree to our{' '}
          <Text style={{ color: colors.textPrimary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${WEBSITE}/terms`)}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={{ color: colors.textPrimary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${WEBSITE}/privacy`)}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Already have an account? </Text>
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.s5,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.s1,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s2,
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  subtitle: {
    fontSize: fontSize.sm,
  },
  strengthRow: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthPill: {
    flex: 1,
    height: 5,
    borderRadius: radius.full,
  },
  legal: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
