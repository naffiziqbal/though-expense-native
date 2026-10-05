import { Redirect, Tabs } from 'expo-router';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CORE_HEIGHT } from '../../constants/tabBar';
import { fonts, radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTourTarget } from '../../hooks/useTourTarget';
import { TOUR_TARGETS } from '../../lib/tourSteps';
import {
  TabAddIcon,
  TabExpensesIcon,
  TabHomeIcon,
  TabInsightsIcon,
  TabSettingsIcon,
} from '../../components/navigation/TabBarIcons';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const needsTour = useOnboardingStore((s) => s.needsTour);
  const isTourActive = useOnboardingStore((s) => s.isActive);
  const startTour = useOnboardingStore((s) => s.start);

  const addTarget = useTourTarget(TOUR_TARGETS.tabAdd);
  const insightsTarget = useTourTarget(TOUR_TARGETS.tabInsights);

  // Home-screen shortcuts navigate via params.href. Must live below the root
  // layout, which is why it is here and not in app/_layout.tsx.
  useQuickActionRouting();

  // Start the tour here rather than at the root, so it can only begin once the
  // user is actually inside the app shell it points at.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    if (isTourActive || !needsTour(user.id)) return;
    startTour();
  }, [isAuthenticated, isLoading, isTourActive, needsTour, startTour, user]);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bgSurface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: TAB_BAR_CORE_HEIGHT + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabHomeIcon color={color} size={focused ? 27 : 24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, focused }) => (
            <TabExpensesIcon color={color} size={focused ? 27 : 24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              style={styles.fabWrap}
              accessibilityLabel="Add expense"
              accessibilityRole="button"
            >
              <View {...addTarget} style={styles.fabTarget}>
                <View style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
                  <TabAddIcon color={colors.onAccent} size={28} />
                </View>
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <View {...insightsTarget}>
              <TabInsightsIcon color={color} size={focused ? 27 : 24} focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabSettingsIcon color={color} size={focused ? 27 : 24} focused={focused} />
          ),
        }}
      />
      {/* Hidden tab routes — keep bottom nav visible (not root stack screens). */}
      <Tabs.Screen name="budget" options={{ href: null }} />
      <Tabs.Screen name="goals" options={{ href: null }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
      <Tabs.Screen name="recurring" options={{ href: null, headerShown: true, title: 'Recurring' }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: true, title: 'Notifications' }} />
      <Tabs.Screen name="profile-edit" options={{ href: null, headerShown: true, title: 'Edit Profile' }} />
      <Tabs.Screen name="security" options={{ href: null, headerShown: true, title: 'Security' }} />
      <Tabs.Screen name="currencies" options={{ href: null, headerShown: true, title: 'Currency' }} />
      <Tabs.Screen name="premium" options={{ href: null, headerShown: true, title: 'Premium' }} />
      <Tabs.Screen name="device-settings" options={{ href: null, headerShown: true, title: 'Device Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sized to the button so the tour spotlight hugs it, not the whole tab slot.
  // Carries the lift so the measured box matches where the button is drawn.
  fabTarget: {
    width: 60,
    height: 60,
    marginTop: -32,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
