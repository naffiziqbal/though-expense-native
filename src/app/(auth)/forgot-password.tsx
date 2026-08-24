import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { toast } from '../../store/toastStore';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email) return setError('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Invalid email format');

    setIsLoading(true);
    try {
      const response = await api.forgotPassword(email);
      if (response.success) {
        setEmailSent(true);
        toast.success(response.message);
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Something went wrong. Please try again.');
      toast.error(message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Screen safeTop contentStyle={styles.content}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="mail" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
            If an account exists for <Text style={{ fontFamily: fonts.bold, color: colors.textPrimary }}>{email}</Text>,
            you’ll receive a password reset link shortly.
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted, textAlign: 'center' }]}>
            The link will expire in 1 hour. Don’t see it? Check your spam folder.
          </Text>
        </View>
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.backRow}>
            <Ionicons name="arrow-back" size={18} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>Back to login</Text>
          </Pressable>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen safeTop contentStyle={styles.content}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Ionicons name="trending-up" size={24} color={colors.onAccent} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Forgot password?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your email and we’ll send you a reset link
        </Text>
      </View>

      <View style={{ gap: spacing.s3 }}>
        <Input
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Button title="Send reset link" onPress={handleSubmit} loading={isLoading} size="lg" />
      </View>

      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.backRow}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>Back to login</Text>
        </Pressable>
      </Link>
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
    gap: spacing.s2,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
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
    maxWidth: 320,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
  },
});
