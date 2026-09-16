import { Redirect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { useSafeTop } from '../hooks/useSafeTop';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const topInset = useSafeTop();
  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const complete = useOnboardingStore((s) => s.complete);
  const needsOnboarding = useOnboardingStore((s) => s.needsOnboarding);

  const finish = useCallback(() => {
    if (userId) complete(userId);
    router.replace('/(tabs)/add');
  }, [complete, router, userId]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bgPrimary,
          paddingTop: topInset,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userId && !needsOnboarding(userId)) {
    return <Redirect href="/(tabs)" />;
  }

  return <OnboardingFlow onComplete={finish} />;
}
