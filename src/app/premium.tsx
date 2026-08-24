import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';

const benefits = [
  { title: 'No ads', desc: 'Clean, distraction-free experience' },
  { title: 'Receipt scanning', desc: 'Scan receipts with camera or upload' },
  { title: 'Full expense history', desc: 'Access all your past transactions' },
  { title: 'Export (CSV & PDF)', desc: 'Download your data anytime' },
  { title: 'Daily & Weekly insights', desc: 'Granular AI spending analysis' },
];

export default function PremiumScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: spacing.s2 }}>
        <View style={[styles.crown, { backgroundColor: colors.accent }]}>
          <Ionicons name="star" size={30} color={colors.onAccent} />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700' }}>
          ThoughtExpense Premium
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
          {isPremium
            ? "You're a Premium member. Enjoy all features!"
            : 'Unlock the full power of your expense tracker'}
        </Text>
      </View>

      <Card>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '600', marginBottom: spacing.s3 }}>
          {isPremium ? 'What you have' : 'What you get'}
        </Text>
        <View style={{ gap: spacing.s3 }}>
          {benefits.map((b) => (
            <View key={b.title} style={{ flexDirection: 'row', gap: spacing.s3 }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{b.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {!isPremium ? (
        <Card style={{ alignItems: 'center', gap: spacing.s2 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Ready to upgrade?</Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
            In-app purchases are coming soon. Stay tuned for updates!
          </Text>
          <Button title="Coming Soon" disabled onPress={() => {}} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  crown: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
