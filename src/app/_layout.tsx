import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/ui/ToastHost';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgSurface },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bgPrimary },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="budget" options={{ title: 'Monthly Budget' }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="security" options={{ title: 'Security' }} />
          <Stack.Screen name="currencies" options={{ title: 'Currency' }} />
          <Stack.Screen name="premium" options={{ title: 'Premium' }} />
          <Stack.Screen name="device-settings" options={{ title: 'Device Settings' }} />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
