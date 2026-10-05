import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { DateField } from '../../components/ui/DateField';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  GOAL_STARTER_IDEAS,
  deadlineLabel,
  quickContributeAmounts,
  summarizeGoals,
} from '../../lib/goalsDashboard';
import { api, getErrorMessage } from '../../lib/api';
import type { Goal } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

export default function GoalsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState('');
  const [contributing, setContributing] = useState(false);

  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  const openCreate = (prefill?: { name: string; targetAmount: number }) => {
    setName(prefill?.name ?? '');
    setTarget(prefill ? String(prefill.targetAmount) : '');
    setDeadline('');
    setCreateOpen(true);
  };

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
      const res = await api.createGoal({
        name: name.trim(),
        targetAmount: amount,
        ...(deadline.trim() ? { deadline: deadline.trim() } : {}),
      });
      if (res.success) {
        toast.success('Goal created');
        setCreateOpen(false);
        setName('');
        setTarget('');
        setDeadline('');
        fetchGoals();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create goal'));
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async (amountOverride?: number) => {
    if (!contributeGoal) return;
    const amount = amountOverride ?? parseFloat(contribution.replace(/,/g, ''));
    if (!amount || amount === 0) {
      toast.error('Enter an amount');
      return;
    }
    setContributing(true);
    try {
      const res = await api.contributeToGoal(contributeGoal.id, amount);
      if (res.success) {
        toast.success(res.message || 'Updated goal');
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

  const openEdit = (goal: Goal) => {
    setEditGoal(goal);
    setEditName(goal.name);
    setEditTarget(String(goal.targetAmount));
    setEditDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
  };

  const handleSaveEdit = async () => {
    if (!editGoal) return;
    const amount = parseFloat(editTarget.replace(/,/g, ''));
    if (!editName.trim() || !amount || amount <= 0) {
      toast.error('Check name and target');
      return;
    }
    setEditSaving(true);
    try {
      await api.updateGoal(editGoal.id, {
        name: editName.trim(),
        targetAmount: amount,
        deadline: editDeadline.trim() ? editDeadline.trim() : null,
      });
      toast.success('Goal updated');
      setEditGoal(null);
      fetchGoals();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update goal'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = (goal: Goal) => {
    Alert.alert('Delete goal', `Remove "${goal.name}"? Saved progress for this goal will be lost.`, [
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

  const openGoalMenu = (goal: Goal) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Edit', 'Delete', 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) openEdit(goal);
          if (index === 1) handleDelete(goal);
        }
      );
      return;
    }
    Alert.alert(goal.name, undefined, [
      { text: 'Edit', onPress: () => openEdit(goal) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(goal) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const summary = summarizeGoals(goals);
  const contributeQuick =
    contributeGoal && !contributing
      ? quickContributeAmounts(contributeGoal.remaining, contributeGoal.currency)
      : [];

  const renderGoal = (goal: Goal) => {
    const pct = Math.min(100, Math.round(goal.progress * 100));
    const done = goal.status === 'completed';
    const due = deadlineLabel(goal.deadline);

    return (
      <View
        key={goal.id}
        style={[
          styles.goalCard,
          {
            borderColor: done ? `${colors.accent}55` : colors.border,
            backgroundColor: colors.bgCard,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
          <View style={[styles.goalIcon, { backgroundColor: done ? colors.accentSoft : colors.inputBg }]}>
            <Ionicons name={done ? 'trophy' : 'cash-outline'} size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }} numberOfLines={1}>
              {goal.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
              {formatCurrency(goal.savedAmount, goal.currency)} of {formatCurrency(goal.targetAmount, goal.currency)}
            </Text>
            {goal.deadline ? (
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                Target {formatDate(goal.deadline)}
                {due ? ` · ${due}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.goalMetaCol}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>{pct}%</Text>
            <Pressable onPress={() => openGoalMenu(goal)} hitSlop={8} accessibilityLabel={`Options for ${goal.name}`}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.track, { backgroundColor: colors.inputBg, marginTop: spacing.s3 }]}>
          <View
            style={{
              width: `${pct}%`,
              backgroundColor: done ? colors.success : colors.accent,
              height: 8,
              borderRadius: radius.full,
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.s3 }}>
          {done ? (
            <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Goal reached</Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              {formatCurrency(goal.remaining, goal.currency)} to go
            </Text>
          )}
          {!done ? (
            <Pressable
              onPress={() => {
                setContributeGoal(goal);
                setContribution('');
              }}
              style={[styles.addChip, { backgroundColor: colors.accentSoft }]}
            >
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.xs }}>Add funds</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={() => fetchGoals(true)} contentStyle={{ gap: spacing.s3 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Goals</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Track what you&apos;re saving for</Text>
        </View>
        <Pressable
          onPress={() => openCreate()}
          accessibilityLabel="New goal"
          style={[
            styles.addGoalBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.bgCard,
            },
          ]}
        >
          <Ionicons name="add" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={[styles.loadingBox, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Loading goals…</Text>
        </View>
      ) : goals.length === 0 ? (
        <View style={{ gap: spacing.s4 }}>
          <View style={[styles.emptyBox, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>No goals yet</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: spacing.s1, lineHeight: 18 }}>
              Set a target and log when you set money aside — separate from everyday spending.
            </Text>
            <Button title="Create a goal" style={{ marginTop: spacing.s4 }} onPress={() => openCreate()} />
          </View>
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Popular starters</Text>
            <View style={[styles.starterList, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              {GOAL_STARTER_IDEAS.map((idea, i) => (
                <Pressable
                  key={idea.name}
                  onPress={() => openCreate(idea)}
                  style={[
                    styles.starterRow,
                    i < GOAL_STARTER_IDEAS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>{idea.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{formatCurrency(idea.targetAmount, currency)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.s3 }}>
          {summary.active.length > 0 ? (
            <View style={[styles.summaryCard, { borderColor: `${colors.accent}55`, backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Active goals</Text>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 28, marginTop: 4 }}>
                {formatCurrency(summary.totalSaved, currency)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
                of {formatCurrency(summary.totalTarget, currency)} target
                {summary.completed.length > 0 ? ` · ${summary.completed.length} completed` : ''}
              </Text>
              <View style={[styles.track, { backgroundColor: colors.bgCard, marginTop: spacing.s3 }]}>
                <View
                  style={{
                    width: `${Math.round(summary.overallProgress * 100)}%`,
                    backgroundColor: colors.accent,
                    height: 8,
                    borderRadius: radius.full,
                  }}
                />
              </View>
            </View>
          ) : null}

          {summary.active.map(renderGoal)}

          {summary.completed.length > 0 ? (
            <View style={{ gap: spacing.s3 }}>
              <Pressable onPress={() => setShowCompleted((v) => !v)} style={styles.completedToggle}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>
                  Completed ({summary.completed.length})
                </Text>
                <Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {showCompleted ? summary.completed.map(renderGoal) : null}
            </View>
          ) : null}
        </View>
      )}

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="New goal">
        <View style={{ gap: spacing.s3 }}>
          <Input label="What are you saving for?" placeholder="e.g. Emergency fund" value={name} onChangeText={setName} />
          <Input label={`Target (${currency})`} placeholder="Amount" keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
          <DateField
            label="Deadline (optional)"
            value={deadline}
            onChange={setDeadline}
            minimumDate={new Date()}
            clearable
          />
          <Button title="Create goal" onPress={handleCreate} loading={saving} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={!!contributeGoal}
        onClose={() => setContributeGoal(null)}
        title={contributeGoal ? `Add to ${contributeGoal.name}` : ''}
      >
        <View style={{ gap: spacing.s3 }}>
          {contributeGoal ? (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              {formatCurrency(contributeGoal.remaining, contributeGoal.currency)} left to hit your target.
            </Text>
          ) : null}
          {contributeQuick.length > 0 ? (
            <View style={styles.chipRow}>
              {contributeQuick.map((amt) => (
                <Pressable
                  key={amt}
                  disabled={contributing}
                  onPress={() => handleContribute(amt)}
                  style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, fontFamily: fonts.medium }}>
                    +{formatCurrency(amt, contributeGoal?.currency || currency)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Input
            label={`Custom amount (${contributeGoal?.currency || currency})`}
            placeholder="How much did you set aside?"
            keyboardType="decimal-pad"
            value={contribution}
            onChangeText={setContribution}
          />
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Use a negative amount to undo a contribution.</Text>
          <Button title="Add" onPress={() => handleContribute()} loading={contributing} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!editGoal} onClose={() => setEditGoal(null)} title="Edit goal">
        <View style={{ gap: spacing.s3 }}>
          <Input label="Name" value={editName} onChangeText={setEditName} />
          <Input label="Target" keyboardType="decimal-pad" value={editTarget} onChangeText={setEditTarget} />
          <DateField label="Deadline (optional)" value={editDeadline} onChange={setEditDeadline} clearable />
          <Button title="Save changes" onPress={handleSaveEdit} loading={editSaving} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  backBtn: {
    marginLeft: -spacing.s1,
  },
  addGoalBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalMetaCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.s1,
  },
  loadingBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.s8,
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.s2,
    marginLeft: spacing.s1,
  },
  starterList: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  starterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  goalCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  addChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
  },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s1,
    marginTop: spacing.s1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
  },
});
