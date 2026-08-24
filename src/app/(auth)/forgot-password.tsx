import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { toast } from '../../store/toastStore';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async () => {
    setError(null);
    if (!email) return setError('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Invalid email format');

    setIsLoading(true);
    try {
      const response = await api.forgotPassword(email);
      if (response.success) {
        toast.success(response.message);
        setOtp('');
        setStep('otp');
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Something went wrong. Please try again.');
      toast.error(message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (otp.trim().length !== 6) return setError('Enter the 6-digit code from your email');

    setIsLoading(true);
    try {
      const response = await api.verifyResetOtp(email, otp.trim());
      if (response.success && response.data?.resetToken) {
        setResetToken(response.data.resetToken);
        setStep('password');
      } else {
        setError('Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    if (!password) return setError('New password is required');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setIsLoading(true);
    try {
      const response = await api.resetPassword(resetToken, password);
      if (response.success) {
        toast.success('Password reset! Sign in with your new password.');
        router.replace('/(auth)/login');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const headers: Record<Step, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
    email: {
      title: 'Forgot password?',
      subtitle: 'Enter your email and we will send you a 6-digit code',
      icon: 'trending-up',
    },
    otp: {
      title: 'Check your email',
      subtitle: `We sent a 6-digit code to ${email}. It expires in 10 minutes.`,
      icon: 'mail',
    },
    password: {
      title: 'Set a new password',
      subtitle: 'Code verified — choose your new password',
      icon: 'lock-closed',
    },
  };
  const header = headers[step];

  return (
    <Screen safeTop contentStyle={styles.content}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: step === 'email' ? colors.accent : colors.accentSoft }]}>
          <Ionicons name={header.icon} size={26} color={step === 'email' ? colors.onAccent : colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{header.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>{header.subtitle}</Text>
      </View>

      {step === 'email' ? (
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
          <Button title="Send code" onPress={handleSendOtp} loading={isLoading} size="lg" />
        </View>
      ) : null}

      {step === 'otp' ? (
        <View style={{ gap: spacing.s3 }}>
          <TextInput
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="......"
            placeholderTextColor={colors.textMuted}
            maxLength={6}
            style={[
              styles.otpInput,
              { backgroundColor: colors.inputBg, borderColor: error ? colors.error : colors.border, color: colors.textPrimary },
            ]}
          />
          {error ? <Text style={{ color: colors.error, fontSize: fontSize.sm, textAlign: 'center' }}>{error}</Text> : null}
          <Button title="Verify code" onPress={handleVerifyOtp} loading={isLoading} size="lg" disabled={otp.length !== 6} />
          <Pressable onPress={handleSendOtp} disabled={isLoading} style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>Resend code</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'password' ? (
        <View style={{ gap: spacing.s3 }}>
          <Input
            placeholder="New password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
              </Pressable>
            }
          />
          <Input
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            error={error}
          />
          <Button title="Reset password" onPress={handleResetPassword} loading={isLoading} size="lg" />
        </View>
      ) : null}

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
  otpInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.s3,
    fontSize: 28,
    fontFamily: fonts.bold,
    textAlign: 'center',
    letterSpacing: 12,
  },
});
