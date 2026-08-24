import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import { toast } from '../store/toastStore';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Screen keyboardAvoiding>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.s6 }}>
        <View style={[styles.iconBubble, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="shield-checkmark" size={26} color="#059669" />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontFamily: fonts.bold, marginTop: spacing.s3 }}>
          Security
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
          Change your password to keep your account secure
        </Text>
      </Card>

      <Card style={{ gap: spacing.s3 }}>
        <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Change Password</Text>
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
          placeholder="Enter new password (min 6 characters)"
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
          title="Update Password"
          size="lg"
          onPress={handleSubmit}
          loading={isSaving}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
