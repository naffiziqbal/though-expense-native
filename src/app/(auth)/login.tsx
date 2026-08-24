import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

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
    <Screen keyboardAvoiding contentStyle={styles.content}>
      {/* Brand anchor */}
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Ionicons name="trending-up" size={24} color={colors.onAccent} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Securely login to your wallet</Text>
      </View>

      <View style={{ gap: spacing.s3 }}>
        <Input
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          rightElement={
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </Pressable>
          }
        />
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable style={{ alignSelf: 'flex-end' }}>
            <Text style={[styles.link, { color: colors.accent }]}>Forgot password?</Text>
          </Pressable>
        </Link>
        <Button title="Sign In" onPress={handleSubmit} loading={isLoading} size="lg" />
      </View>

      <View style={styles.footerRow}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Don’t have an account? </Text>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <Text style={[styles.link, { color: colors.accent }]}>Sign up for free</Text>
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
  link: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
