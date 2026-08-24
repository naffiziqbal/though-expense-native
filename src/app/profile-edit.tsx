import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import type { User } from '../lib/types';
import { getImageUrl } from '../lib/utils';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

export default function ProfileEditScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [pendingImage, setPendingImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameChanged = name !== (user?.name || '');
  const hasChanges = nameChanged || pendingImage !== null;

  const displayImageUrl = pendingImage?.uri ?? getImageUrl(user?.profilePicture || user?.profilePictureUrl);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setError(null);
      setPendingImage(result.assets[0]);
    }
  };

  const handleSave = async () => {
    if (!hasChanges || !user) return;
    setError(null);
    setIsSaving(true);
    try {
      let updatedUser: User = { ...user };

      if (pendingImage) {
        const res = await api.uploadProfilePicture(
          pendingImage.uri,
          pendingImage.mimeType || 'image/jpeg',
          pendingImage.fileName || 'avatar.jpg'
        );
        if (res.success && res.data?.user) {
          updatedUser = res.data.user;
          setPendingImage(null);
        } else {
          setError('Failed to upload image. Please try again.');
          setIsSaving(false);
          return;
        }
      }

      if (nameChanged) {
        const res = await api.updateProfile({ name: name || null });
        if (res.success && res.data?.user) {
          updatedUser = { ...updatedUser, ...res.data.user };
        } else {
          setError('Failed to save name. Please try again.');
          setIsSaving(false);
          return;
        }
      }

      setUser(updatedUser);
      toast.success('Profile updated');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen keyboardAvoiding>
      {/* Avatar section */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing.s6 }}>
        <Pressable onPress={pickImage} disabled={isSaving}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            {displayImageUrl ? (
              <Image source={{ uri: displayImageUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.avatarInitial}>{(name || user?.email)?.[0]?.toUpperCase() || '?'}</Text>
            )}
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </View>
        </Pressable>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.s2 }}>
          Tap to change photo
        </Text>
      </Card>

      {/* Form */}
      <Card style={{ gap: spacing.s4 }}>
        <Input label="Full Name" placeholder="Enter your name" value={name} onChangeText={setName} error={error} autoCapitalize="words" />
        <Input label="Email" value={user?.email || ''} editable={false} hint="Email cannot be changed" style={{ opacity: 0.6 }} />
        <Button title="Save Changes" size="lg" onPress={handleSave} loading={isSaving} disabled={!hasChanges} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 40,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
