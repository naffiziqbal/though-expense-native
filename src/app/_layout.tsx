import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/ui/ToastHost';
import { fonts } from '../constants/theme';
import { api } from '../lib/api';
import { configureBilling, identifyBilling } from '../lib/billing';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const userId = useAuthStore((s) => s.user?.id);
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  useEffect(() => {
    api.loadBaseUrl().finally(() => checkAuth());
    configureBilling();
  }, [checkAuth]);

  useEffect(() => {
    if (userId) {
      configureBilling(userId);
      identifyBilling(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgSurface },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontFamily: fonts.semibold },
            contentStyle: { backgroundColor: colors.bgPrimary },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="budget" options={{ title: 'Monthly Budget' }} />
          <Stack.Screen name="assistant" options={{ title: 'AI Advisor' }} />
          <Stack.Screen name="goals" options={{ title: 'Savings Goals' }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="security" options={{ title: 'Security' }} />
          <Stack.Screen name="currencies" options={{ title: 'Currency' }} />
          <Stack.Screen name="premium" options={{ title: 'Premium' }} />
          <Stack.Screen name="device-settings" options={{ title: 'Device Settings' }} />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
