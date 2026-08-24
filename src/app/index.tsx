import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
