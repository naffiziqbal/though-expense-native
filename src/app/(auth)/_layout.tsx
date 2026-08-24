import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';

export default function AuthLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuthStore();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgPrimary },
      }}
    />
  );
}
