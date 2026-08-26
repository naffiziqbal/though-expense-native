import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import type { Goal } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

export default function GoalsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState('');
  const [contributing, setContributing] = useState(false);

  const fetchGoals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.getGoals();
      if (res.success) setGoals(res.data.goals);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGoals();
    }, [fetchGoals])
  );

  const handleCreate = async () => {
    const amount = parseFloat(target.replace(/,/g, ''));
    if (!name.trim()) {
      toast.error('Give your goal a name');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('Enter a valid target amount');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createGoal({ name: name.trim(), targetAmount: amount });
      if (res.success) {
        toast.success('Goal created');
        setCreateOpen(false);
        setName('');
        setTarget('');
        fetchGoals();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create goal'));
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async () => {
    if (!contributeGoal) return;
    const amount = parseFloat(contribution.replace(/,/g, ''));
    if (!amount) {
      toast.error('Enter an amount');
      return;
    }
    setContributing(true);
    try {
      const res = await api.contributeToGoal(contributeGoal.id, amount);
      if (res.success) {
        toast.success(res.message);
        setContributeGoal(null);
        setContribution('');
        fetchGoals();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add contribution'));
    } finally {
      setContributing(false);
    }
  };

  const handleDelete = (goal: Goal) => {
    Alert.alert('Delete goal', `Delete "${goal.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteGoal(goal.id);
            toast.success('Goal deleted');
            fetchGoals();
          } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to delete goal'));
          }
        },
      },
    ]);
  };

  const active = goals.filter((g) => g.status === 'active');
  const completed = goals.filter((g) => g.status === 'completed');

  const renderGoal = (goal: Goal) => {
    const pct = Math.round(goal.progress * 100);
    const done = goal.status === 'completed';
    return (
      <Card key={goal.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
          <View style={[styles.goalIcon, { backgroundColor: done ? colors.accentSoft : colors.accentSoft }]}>
            <Ionicons name={done ? 'trophy' : 'flag'} size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }} numberOfLines={1}>
              {goal.name}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              {formatCurrency(goal.savedAmount, goal.currency)} of {formatCurrency(goal.targetAmount, goal.currency)}
            </Text>
          </View>
          <Pressable onPress={() => handleDelete(goal)} hitSlop={8} accessibilityLabel={`Delete ${goal.name}`}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.track, { backgroundColor: colors.border, marginTop: spacing.s3 }]}>
          <View
            style={{
              width: `${Math.min(100, pct)}%`,
              backgroundColor: done ? colors.success : colors.accent,
              height: 10,
              borderRadius: radius.full,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s1 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{pct}% saved</Text>
          {!done ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              {formatCurrency(goal.remaining, goal.currency)} to go
            </Text>
          ) : (
            <Text style={{ color: colors.success, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>
              Completed 🎉
            </Text>
          )}
        </View>

        {!done ? (
          <Button
            title="Add savings"
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.s3 }}
            onPress={() => {
              setContributeGoal(goal);
              setContribution('');
            }}
          />
        ) : null}
      </Card>
    );
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchGoals(true)}>
      <View style={styles.headerRow}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 }}>
          Put money aside for what matters — track it here.
        </Text>
        <Button title="New goal" size="sm" onPress={() => setCreateOpen(true)} />
      </View>

      {isLoading ? (
        <Card>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.s4 }}>
            Loading goals…
          </Text>
        </Card>
      ) : goals.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title="No savings goals yet"
          message="Create your first goal — a trip, an emergency fund, a new phone — and track your progress."
          actionTitle="Create a goal"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <>
          {active.map(renderGoal)}
          {completed.length > 0 ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                Completed
              </Text>
              {completed.map(renderGoal)}
            </>
          ) : null}
        </>
      )}

      {/* Create goal sheet */}
      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="New savings goal">
        <View style={{ gap: spacing.s3 }}>
          <Input
            label="What are you saving for?"
            placeholder="e.g. Emergency fund"
            value={name}
            onChangeText={setName}
          />
          <Input
            label={`Target amount (${user?.currency || 'USD'})`}
            placeholder="e.g. 50000"
            keyboardType="numeric"
            value={target}
            onChangeText={setTarget}
          />
          <Button title="Create goal" onPress={handleCreate} loading={saving} />
        </View>
      </BottomSheet>

      {/* Contribute sheet */}
      <BottomSheet
        visible={!!contributeGoal}
        onClose={() => setContributeGoal(null)}
        title={contributeGoal ? `Add to "${contributeGoal.name}"` : ''}
      >
        <View style={{ gap: spacing.s3 }}>
          {contributeGoal ? (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              {formatCurrency(contributeGoal.remaining, contributeGoal.currency)} left to reach your target.
            </Text>
          ) : null}
          <Input
            label={`Amount (${contributeGoal?.currency || user?.currency || 'USD'})`}
            placeholder="How much did you put aside?"
            keyboardType="numeric"
            value={contribution}
            onChangeText={setContribution}
          />
          <Button title="Add savings" onPress={handleContribute} loading={contributing} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
});
