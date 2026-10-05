import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { useScreenBack } from '../../lib/hiddenTabNavigation';
import {
  RECURRING_PAGE_HINT,
  describeRecurringSchedule,
  formatRecurringNextRun,
  normalizeRecurringDescription,
  summarizeRecurringRules,
} from '../../lib/recurringDashboard';
import type { DetectedRecurring, RecurringFrequency, RecurringRule } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DraftState {
  description: string;
  amount: string;
  category: string;
  currency: string;
  frequency: RecurringFrequency;
  dayOfMonth: number;
  dayOfWeek: number;
}

export default function RecurringScreen() {
  const { colors } = useTheme();
  const goBack = useScreenBack('/(tabs)/profile');
  const user = useAuthStore((s) => s.user);
  const fallbackCurrency = user?.currency || 'USD';

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [detected, setDetected] = useState<DetectedRecurring[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [rulesRes, detectedRes] = await Promise.all([
        api.getRecurringRules(),
        api.getRecurringExpenses().catch(() => null),
      ]);
      if (rulesRes.success) setRules(rulesRes.data.rules);
      if (detectedRes?.success) setDetected(detectedRes.data.recurring);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not load recurring expenses'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const suggestions = useMemo(() => {
    const automated = new Set(rules.map((r) => normalizeRecurringDescription(r.description)));
    return detected.filter((d) => !automated.has(normalizeRecurringDescription(d.description)));
  }, [detected, rules]);

  const summary = useMemo(() => summarizeRecurringRules(rules), [rules]);

  const openDraft = (item: DetectedRecurring) => {
    const lastDate = new Date(item.lastDate);
    const day = Number.isNaN(lastDate.getTime()) ? 1 : lastDate.getDate();
    setDraft({
      description: item.description,
      amount: String(item.averageAmount),
      category: item.category,
      currency: item.currency || fallbackCurrency,
      frequency: 'monthly',
      dayOfMonth: Math.min(day, 28),
      dayOfWeek: Number.isNaN(lastDate.getTime()) ? 1 : lastDate.getDay(),
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!amount || !isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setIsSavingDraft(true);
    try {
      const res = await api.createRecurringRule({
        description: draft.description,
        amount,
        currency: draft.currency,
        category: draft.category,
        frequency: draft.frequency,
        ...(draft.frequency === 'monthly'
          ? { dayOfMonth: draft.dayOfMonth }
          : { dayOfWeek: draft.dayOfWeek }),
      });
      if (res.success) {
        setRules((prev) => [...prev, res.data.rule]);
        setDraft(null);
        toast.success('Will be logged automatically');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save recurring expense'));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const togglePaused = async (rule: RecurringRule) => {
    setBusyId(rule.id);
    try {
      const res = await api.updateRecurringRule(rule.id, { isActive: !rule.isActive });
      if (res.success) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? res.data.rule : r)));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update'));
    } finally {
      setBusyId(null);
    }
  };

  const logNow = async (rule: RecurringRule) => {
    setBusyId(rule.id);
    try {
      const res = await api.runRecurringRule(rule.id);
      if (res.success) {
        toast.success('Logged');
        await load();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not log expense'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (rule: RecurringRule) => {
    setBusyId(rule.id);
    try {
      await api.deleteRecurringRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('Removed');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove'));
    } finally {
      setBusyId(null);
    }
  };

  const renderRule = (rule: RecurringRule, showBorder: boolean) => (
    <View
      key={rule.id}
      style={[styles.ruleBlock, showBorder && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
        <CategoryIconBubble category={rule.category} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }} numberOfLines={1}>
            {rule.description}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
            {describeRecurringSchedule(rule)}
            {rule.isActive ? ` · next ${formatRecurringNextRun(rule.nextRunAt)}` : ' · paused'}
          </Text>
        </View>
        <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
          {formatCurrency(rule.amount, rule.currency)}
        </Text>
      </View>

      <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2, flex: 1 }}>
          <Switch
            value={rule.isActive}
            disabled={busyId === rule.id}
            onValueChange={() => togglePaused(rule)}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.bgCard}
          />
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>{rule.isActive ? 'Active' : 'Paused'}</Text>
        </View>
        <Pressable
          onPress={() => logNow(rule)}
          disabled={busyId === rule.id}
          hitSlop={6}
          style={[styles.chip, { borderColor: colors.border }]}
        >
          <Ionicons name="add" size={14} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>Log now</Text>
        </Pressable>
        <Pressable onPress={() => remove(rule)} disabled={busyId === rule.id} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={() => load(true)} contentStyle={{ gap: spacing.s3 }}>
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Recurring</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{RECURRING_PAGE_HINT}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.s8, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : rules.length === 0 && suggestions.length === 0 ? (
        <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
          <Ionicons name="repeat" size={28} color={colors.accent} />
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm, marginTop: spacing.s3 }}>
            No recurring expenses yet
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: spacing.s1, lineHeight: 18, textAlign: 'center' }}>
            Log the same subscription or bill for a few months and we&apos;ll suggest automating it here.
          </Text>
        </View>
      ) : (
        <>
          {summary.total > 0 ? (
            <View style={[styles.summaryCard, { borderColor: `${colors.accent}44`, backgroundColor: colors.bgCard }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Automated</Text>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 28, marginTop: 4 }}>
                {summary.active.length}
                <Text style={{ fontSize: fontSize.md, color: colors.textMuted }}> active</Text>
              </Text>
              {summary.next ? (
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: spacing.s1 }} numberOfLines={1}>
                  Next: {summary.next.description} · {formatRecurringNextRun(summary.next.nextRunAt)}
                </Text>
              ) : (
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: spacing.s1 }}>All rules paused</Text>
              )}
            </View>
          ) : null}

          {rules.length > 0 ? (
            <View style={{ gap: spacing.s2 }}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Your rules</Text>
              <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                {rules.map((rule, i) => renderRule(rule, i < rules.length - 1))}
              </View>
            </View>
          ) : null}

          {suggestions.length > 0 ? (
            <View style={{ gap: spacing.s2 }}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Suggested from history</Text>
              <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                {suggestions.map((item, i) => (
                  <View
                    key={item.description}
                    style={[
                      styles.suggestionRow,
                      i < suggestions.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <CategoryIconBubble category={item.category} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }} numberOfLines={1}>
                        {item.description}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                        {item.category} · {item.monthsSeen} mo · ~{formatCurrency(item.averageAmount, item.currency)}
                      </Text>
                    </View>
                    <Pressable onPress={() => openDraft(item)} style={[styles.chip, { borderColor: colors.accent }]}>
                      <Ionicons name="repeat" size={14} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>Automate</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}

      <BottomSheet visible={!!draft} onClose={() => setDraft(null)} title="Log this automatically">
        {draft ? (
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              We&apos;ll add &ldquo;{draft.description}&rdquo; for you on schedule. You can pause it any time.
            </Text>

            <Input
              label="Amount"
              value={draft.amount}
              onChangeText={(amount) => setDraft({ ...draft, amount })}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            <View style={{ gap: spacing.s2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>Repeats</Text>
              <SegmentedControl
                segments={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'weekly', label: 'Weekly' },
                ]}
                value={draft.frequency}
                onChange={(frequency) => setDraft({ ...draft, frequency: frequency as RecurringFrequency })}
              />
            </View>

            {draft.frequency === 'monthly' ? (
              <Input
                label="Day of month"
                value={String(draft.dayOfMonth)}
                onChangeText={(value) => {
                  const day = Math.min(28, Math.max(1, parseInt(value, 10) || 1));
                  setDraft({ ...draft, dayOfMonth: day });
                }}
                keyboardType="number-pad"
                hint="Capped at 28 so it fires every month"
              />
            ) : (
              <View style={{ gap: spacing.s2 }}>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>Day of week</Text>
                <View style={{ flexDirection: 'row', gap: spacing.s1, flexWrap: 'wrap' }}>
                  {WEEKDAYS.map((label, index) => {
                    const active = draft.dayOfWeek === index;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => setDraft({ ...draft, dayOfWeek: index })}
                        style={[
                          styles.dayChip,
                          {
                            borderColor: active ? colors.accent : colors.border,
                            backgroundColor: active ? colors.accentSoft : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? colors.accent : colors.textSecondary,
                            fontSize: fontSize.xs,
                            fontFamily: fonts.medium,
                          }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
              <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
              <Button title="Automate" style={{ flex: 1 }} loading={isSavingDraft} onPress={saveDraft} />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  backBtn: { marginLeft: -spacing.s1, marginTop: 2 },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    marginLeft: spacing.s1,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s6,
    alignItems: 'center',
  },
  ruleBlock: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    gap: spacing.s3,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.s3,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s3,
    paddingVertical: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  dayChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
});
