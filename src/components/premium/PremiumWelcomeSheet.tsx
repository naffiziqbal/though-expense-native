import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { usePremiumWelcomeStore } from '../../store/premiumWelcomeStore';

const highlights = [
  { icon: 'chatbubbles-outline' as const, text: 'Unlimited AI advisor' },
  { icon: 'download-outline' as const, text: 'Export & full history' },
  { icon: 'receipt-outline' as const, text: 'Receipt scan & deeper insights' },
];

export function PremiumWelcomeSheet() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const visible = usePremiumWelcomeStore((s) => s.visible);
  const close = usePremiumWelcomeStore((s) => s.close);
  const name = useAuthStore((s) => s.user?.name?.trim());

  const greeting = name ? `Welcome to Premium, ${name}!` : 'Welcome to Premium!';

  const dismiss = () => close();

  const exploreAdvisor = () => {
    close();
    router.push('/assistant');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
            <Ionicons name="star" size={28} color={colors.onAccent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{greeting}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            You’ve unlocked the full ThoughtExpense experience. Here’s what’s new for you:
          </Text>
          <View style={{ gap: spacing.s2, width: '100%' }}>
            {highlights.map((item) => (
              <View key={item.text} style={styles.row}>
                <Ionicons name={item.icon} size={20} color={colors.accent} />
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, flex: 1 }}>{item.text}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: '100%', gap: spacing.s2, marginTop: spacing.s2 }}>
            <Button title="Ask the AI advisor" size="lg" onPress={exploreAdvisor} />
            <Button title="Continue" variant="outline" size="lg" onPress={dismiss} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>
            {isDark ? 'Thank you for supporting ThoughtExpense.' : 'Thanks for going Premium — happy tracking!'}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.s5,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.s5,
    alignItems: 'center',
    gap: spacing.s3,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
});
