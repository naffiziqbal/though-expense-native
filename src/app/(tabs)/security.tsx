import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { useScreenBack } from '../../lib/hiddenTabNavigation';
import { DELETE_ACCOUNT_WARNING, SECURITY_PAGE_HINT } from '../../lib/securityDashboard';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const goBack = useScreenBack('/(tabs)/profile');
  const logout = useAuthStore((s) => s.logout);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const validate = () => {
    setError(null);
    if (!currentPassword) return setError('Current password is required'), false;
    if (!newPassword) return setError('New password is required'), false;
    if (newPassword.length < 6) return setError('New password must be at least 6 characters'), false;
    if (newPassword !== confirmPassword) return setError('New passwords do not match'), false;
    if (currentPassword === newPassword)
      return setError('New password must be different from current password'), false;
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      if (res.success) {
        toast.success(res.message);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError('Failed to update password. Please try again.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteAccount(deletePassword);
      if (res.success) {
        setDeleteSheetOpen(false);
        toast.success('Your account has been deleted');
        await logout();
        router.replace('/(auth)/login');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete account'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Screen safeTop keyboardAvoiding contentStyle={{ gap: spacing.s3 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Security</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{SECURITY_PAGE_HINT}</Text>
        </View>
      </View>

      <View style={[styles.infoCard, { borderColor: `${colors.accent}44`, backgroundColor: colors.bgCard }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
          </View>
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18 }}>
            Use a unique password you don&apos;t reuse elsewhere. You&apos;ll stay signed in on this device after updating.
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Password</Text>
      <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.bgCard, gap: spacing.s3 }]}>
        <Input
          label="Current password"
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={!showCurrent}
          autoComplete="current-password"
          rightElement={
            <Pressable onPress={() => setShowCurrent(!showCurrent)} hitSlop={8}>
              <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </Pressable>
          }
        />
        <Input
          label="New password"
          placeholder="At least 6 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showNew}
          autoComplete="new-password"
          rightElement={
            <Pressable onPress={() => setShowNew(!showNew)} hitSlop={8}>
              <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </Pressable>
          }
        />
        <Input
          label="Confirm new password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        {error ? <Text style={{ color: colors.error, fontSize: fontSize.sm }}>{error}</Text> : null}
        <Button
          title="Update password"
          size="lg"
          onPress={handleSubmit}
          loading={isSaving}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.error }]}>Danger zone</Text>
      <View style={[styles.formCard, { borderColor: `${colors.error}55`, backgroundColor: colors.bgCard, gap: spacing.s3 }]}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18 }}>
          Permanently delete your account, expenses, budgets, goals, and insights. This cannot be undone.
        </Text>
        <Button title="Delete my account" variant="danger" onPress={() => setDeleteSheetOpen(true)} />
      </View>

      <BottomSheet visible={deleteSheetOpen} onClose={() => setDeleteSheetOpen(false)} title="Delete account?">
        <View style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 }}>{DELETE_ACCOUNT_WARNING}</Text>
          <Input
            label="Password"
            placeholder="Your password"
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDeleteSheetOpen(false)} />
            <Button
              title="Delete forever"
              variant="danger"
              style={{ flex: 1 }}
              onPress={handleDeleteAccount}
              loading={isDeleting}
              disabled={!deletePassword}
            />
          </View>
        </View>
      </BottomSheet>
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
  infoCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    marginLeft: spacing.s1,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
});
