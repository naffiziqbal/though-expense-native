import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import { CURRENCIES } from '../lib/currencies';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

export default function CurrenciesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [selectedCurrency, setSelectedCurrency] = useState(user?.currency || 'USD');
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = selectedCurrency !== (user?.currency || 'USD');

  const handleSave = async () => {
    if (!hasChanges || !user) return;
    setIsSaving(true);
    try {
      const res = await api.updateProfile({ currency: selectedCurrency });
      if (res.success && res.data?.user) {
        setUser({ ...user, ...res.data.user });
        toast.success(`Currency updated — all amounts will now display in ${selectedCurrency}`);
        router.back();
      } else {
        toast.error('Failed to update currency. Please try again.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update currency. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.s6 }}>
        <View style={[styles.iconBubble, { backgroundColor: '#E0E7FF' }]}>
          <Ionicons name="globe" size={26} color="#4F46E5" />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.s3 }}>
          Currency
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4 }}>
          Choose your default currency for expenses
        </Text>
      </Card>

      <Card padded={false}>
        {CURRENCIES.map((currency, i) => {
          const selected = selectedCurrency === currency.value;
          return (
            <Pressable
              key={currency.value}
              onPress={() => setSelectedCurrency(currency.value)}
              style={[
                styles.row,
                selected && { backgroundColor: colors.accentSoft },
                i < CURRENCIES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{currency.label}</Text>
              {selected ? (
                <View style={[styles.check, { backgroundColor: colors.accent }]}>
                  <Ionicons name="checkmark" size={14} color={colors.onAccent} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Card>

      <Button title="Save Changes" size="lg" onPress={handleSave} loading={isSaving} disabled={!hasChanges} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s4,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
