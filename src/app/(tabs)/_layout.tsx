import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CORE_HEIGHT } from '../../constants/tabBar';
import { radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTourTarget } from '../../hooks/useTourTarget';
import { TOUR_TARGETS } from '../../lib/tourSteps';
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
            <Ionicons name={focused ? 'home' : 'home-outline'} size={focused ? 27 : 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'card' : 'card-outline'} size={focused ? 27 : 24} color={color} />
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
                  <Ionicons name="add" size={32} color={colors.onAccent} />
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
              <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={focused ? 27 : 24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={focused ? 27 : 24} color={color} />
          ),
        }}
      />
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
