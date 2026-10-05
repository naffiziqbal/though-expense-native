import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { DailySpendingChart } from '../../components/home/DailySpendingChart';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import { pushHiddenTab } from '../../lib/hiddenTabNavigation';
import { usePendingExpenses } from '../../hooks/usePendingExpenses';
import { useTourTarget } from '../../hooks/useTourTarget';
import {
  budgetPaceLabel,
  buildLastFiveDayBuckets,
  daysInMonth,
  daysLeftInMonth,
  expectedPacePercent,
  expensesToday,
  isoDay,
  sumExpensesOnDay,
  timeOfDayGreeting,
} from '../../lib/homeDashboard';
import { addPendingToTotals } from '../../lib/pendingExpenses';
import { TOUR_TARGETS } from '../../lib/tourSteps';
import type { BudgetSummary, CategorySummary, Expense, Goal, Insight } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: iso(start), endDate: iso(end) };
}

type NotificationItem = {
  id: string;
  type: 'budget-exceeded' | 'budget-warning' | 'insight';
  content: string;
  meta?: string;
};

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const pending = usePendingExpenses();
  const heroTarget = useTourTarget(TOUR_TARGETS.homeTotal);

  const [summary, setSummary] = useState<CategorySummary | null>(null);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);

  const insightPanelBg = isDark ? '#0F2F2C' : colors.accentSoft;
  const nestedTileBg = colors.bgPrimary;
  const progressTrack = isDark ? '#1C2638' : colors.divider;

  useEffect(() => {
    AsyncStorage.getItem('seen-notifications')
      .then((raw) => raw && setSeenIds(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    const { startDate, endDate } = getCurrentMonthRange();
    if (isRefresh) setRefreshing(true);
    try {
      const [summaryRes, expensesRes, insightsRes, budgetRes, goalsRes] = await Promise.all([
        api.getCategorySummary({ startDate, endDate }),
        api.getExpenses({ limit: 100, startDate, endDate }),
        api.getInsights({ limit: 10 }),
        api.getCurrentBudget(),
        api.getGoals().catch(() => null),
      ]);
      if (summaryRes.success) setSummary(summaryRes.data);
      if (expensesRes.success) setMonthExpenses(expensesRes.data.expenses);
      if (insightsRes.success) setInsights(insightsRes.data.insights);
      if (budgetRes.success) setBudget(budgetRes.data);
      if (goalsRes?.success) setGoals(goalsRes.data.goals.filter((g) => g.status === 'active'));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const { startDate, endDate } = getCurrentMonthRange();
  const pendingExpenses: Expense[] = pending.map((p) => ({
    id: `pending:${p.localId}`,
    userId: user?.id || '',
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    category: p.category,
    confidence: 0.6,
    rawInput: p.rawInput,
    date: p.date,
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  }));

  const mergedExpenses = useMemo(() => {
    const ids = new Set(monthExpenses.map((e) => e.id));
    return [...pendingExpenses.filter((e) => !ids.has(e.id)), ...monthExpenses];
  }, [monthExpenses, pendingExpenses]);

  const merged = addPendingToTotals(
    summary?.totalSpent ?? 0,
    summary?.byCategory ?? {},
    pending,
    startDate,
    endDate
  );

  const displayBudget = budget
    ? {
        ...budget,
        total_spent:
          budget.total_spent +
          pending.filter((p) => p.date.slice(0, 10) >= startDate && p.date.slice(0, 10) <= endDate).reduce((s, p) => s + p.amount, 0),
      }
    : budget;
  if (displayBudget) {
    displayBudget.remaining = displayBudget.total_limit - displayBudget.total_spent;
    displayBudget.percentage =
      displayBudget.total_limit > 0 ? Math.round((displayBudget.total_spent / displayBudget.total_limit) * 100) : 0;
  }

  const currency = summary?.currency || user?.currency || 'USD';
  const budgetPct = displayBudget?.percentage ?? 0;
  const expectedPct = expectedPacePercent();
  const paceLabel = budgetPaceLabel(budgetPct, expectedPct);
  const daysLeft = daysLeftInMonth();
  const todayKey = isoDay(new Date());
  const spentToday = sumExpensesOnDay(mergedExpenses, todayKey);
  const dailyBuckets = buildLastFiveDayBuckets(mergedExpenses);
  const dailyLimit =
    displayBudget && displayBudget.total_limit > 0 ? displayBudget.total_limit / daysInMonth() : 0;
  const safePerDay = displayBudget && daysLeft > 0 ? Math.max(0, displayBudget.remaining) / daysLeft : 0;
  const todayExpenses = expensesToday(mergedExpenses);
  const featuredInsight = insights[0];
  const primaryGoal = goals[0];

  const notifications: NotificationItem[] = [];
  if (displayBudget && displayBudget.percentage >= 100) {
    notifications.push({
      id: `budget-exceeded-${displayBudget.year}-${displayBudget.month}`,
      type: 'budget-exceeded',
      content: 'You have exceeded your monthly budget',
      meta: `${formatCurrency(displayBudget.total_spent, currency)} of ${formatCurrency(displayBudget.total_limit, currency)} (${displayBudget.percentage}%)`,
    });
  } else if (displayBudget && displayBudget.percentage >= 90) {
    notifications.push({
      id: `budget-warning-${displayBudget.year}-${displayBudget.month}`,
      type: 'budget-warning',
      content: 'You are about to exceed your monthly budget',
      meta: `${formatCurrency(displayBudget.total_spent, currency)} of ${formatCurrency(displayBudget.total_limit, currency)} (${displayBudget.percentage}%)`,
    });
  }
  insights.forEach((insight) => {
    notifications.push({
      id: insight.id,
      type: 'insight',
      content: insight.content,
      meta: formatDate(insight.createdAt, 'MMM d'),
    });
  });

  const unseenCount = notifications.filter((n) => !seenIds.includes(n.id)).length;

  const openNotifications = () => {
    setNotificationOpen(true);
    const mergedIds = Array.from(new Set([...seenIds, ...notifications.map((n) => n.id)])).slice(-100);
    setSeenIds(mergedIds);
    AsyncStorage.setItem('seen-notifications', JSON.stringify(mergedIds)).catch(() => {});
  };

  const formatExpenseTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <Screen
      safeTop
      contentStyle={[styles.homeContent, styles.homeScrollContent]}
      refreshing={refreshing}
      onRefresh={() => fetchData(true)}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>{timeOfDayGreeting()}</Text>
          <Text style={[styles.nameAccent, { color: colors.accent }]}>
            {user?.name?.split(/\s+/)[0] || 'User'}
          </Text>
        </View>
        <Pressable
          onPress={openNotifications}
          style={[
            styles.bellBtn,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          {unseenCount > 0 ? <View style={[styles.bellDot, { backgroundColor: colors.error }]} /> : null}
        </Pressable>
      </View>

      <Card {...heroTarget} style={styles.heroCard}>
        {displayBudget ? (
          <>
            <View style={styles.heroTopRow}>
              <Text style={[styles.heroKicker, { color: colors.textMuted }]}>Left this month</Text>
              <Text style={[styles.pacePill, { backgroundColor: insightPanelBg, color: colors.accent }]}>
                {paceLabel}
              </Text>
            </View>
            <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
              {loading ? '…' : formatCurrency(Math.max(0, displayBudget.remaining), currency)}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              of {formatCurrency(displayBudget.total_limit, currency)} · {daysLeft} days left
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: progressTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, budgetPct)}%`, backgroundColor: colors.accent },
                ]}
              />
              <View
                style={[
                  styles.paceMarker,
                  { left: `${Math.min(98, Math.max(0, expectedPct))}%`, backgroundColor: colors.textPrimary },
                ]}
              />
            </View>
            <View style={styles.paceLegend}>
              <Text style={[styles.paceLegendText, { color: colors.textMuted }]}>
                Spent {formatCurrency(displayBudget.total_spent, currency)} ({budgetPct}%)
              </Text>
              <Text style={[styles.paceLegendText, { color: colors.textMuted }]}>Expected pace {expectedPct}%</Text>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.statTile, { backgroundColor: nestedTileBg }]}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Safe per day</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatCurrency(safePerDay, currency)}
                </Text>
              </View>
              <View style={[styles.statTile, { backgroundColor: nestedTileBg }]}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Spent today</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatCurrency(spentToday, currency)}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.heroKicker, { color: colors.textMuted }]}>Spent this month</Text>
            <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
              {loading ? '…' : formatCurrency(merged.totalSpent, currency)}
            </Text>
            <Pressable onPress={() => pushHiddenTab(router, '/budget', '/(tabs)')} style={{ marginTop: spacing.s2 }}>
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                Set a monthly budget →
              </Text>
            </Pressable>
          </>
        )}
      </Card>

      {featuredInsight ? (
        <Pressable
          onPress={() => pushHiddenTab(router, '/assistant', '/(tabs)')}
          style={[styles.insightCard, { backgroundColor: insightPanelBg }]}
        >
          <Ionicons name="sparkles" size={20} color={colors.accent} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.insightTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {featuredInsight.content.split(/[.!?]/)[0]?.trim() || featuredInsight.content}
            </Text>
            <Text style={[styles.insightBody, { color: isDark ? '#9FD9D0' : colors.textSecondary }]} numberOfLines={3}>
              {featuredInsight.content}
            </Text>
            <Text style={[styles.insightLink, { color: colors.accent }]}>Ask advisor →</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Daily spending</Text>
        {dailyLimit > 0 ? (
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
            Limit {formatCurrency(dailyLimit, currency)}
          </Text>
        ) : null}
      </View>
      <DailySpendingChart buckets={dailyBuckets} dailyLimit={dailyLimit} />

      {primaryGoal ? (
        <>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Savings goal</Text>
            <Pressable onPress={() => pushHiddenTab(router, '/goals', '/(tabs)')}>
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>View all</Text>
            </Pressable>
          </View>
          <Card style={styles.goalCard}>
            <View style={styles.goalTop}>
              <View style={styles.goalIdentity}>
                <View style={[styles.goalIcon, { backgroundColor: progressTrack }]}>
                  <Ionicons name="laptop-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.goalName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {primaryGoal.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                    {formatCurrency(primaryGoal.savedAmount, primaryGoal.currency)} of{' '}
                    {formatCurrency(primaryGoal.targetAmount, primaryGoal.currency)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.goalPct, { color: colors.textPrimary }]}>
                {Math.round(primaryGoal.progress * 100)}%
              </Text>
            </View>
            <View style={[styles.goalTrack, { backgroundColor: progressTrack }]}>
              <View
                style={[
                  styles.goalFill,
                  { width: `${Math.min(100, primaryGoal.progress * 100)}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
            <View style={styles.goalFoot}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {formatCurrency(Math.max(0, primaryGoal.targetAmount - primaryGoal.savedAmount), primaryGoal.currency)}{' '}
                to go
              </Text>
              <Pressable
                onPress={() => pushHiddenTab(router, '/goals', '/(tabs)')}
                style={[styles.goalChip, { backgroundColor: insightPanelBg }]}
              >
                <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.xs }}>Add funds</Text>
              </Pressable>
            </View>
          </Card>
        </>
      ) : null}

      {todayExpenses.length > 0 ? (
        <>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Today · {formatCurrency(spentToday, currency)}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/expenses')}>
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>View all</Text>
            </Pressable>
          </View>
          <Card padded={false}>
            {todayExpenses.map((expense, i) => (
              <Pressable
                key={expense.id}
                onPress={() => router.push('/(tabs)/expenses')}
                style={[
                  styles.todayRow,
                  i < todayExpenses.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: isDark ? '#1C2638' : colors.divider,
                  },
                ]}
              >
                <CategoryIconBubble category={expense.category} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.todayTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {expense.description}
                  </Text>
                  <Text style={[styles.todayMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {expense.category}
                    {formatExpenseTime(expense.date) ? ` · ${formatExpenseTime(expense.date)}` : ''}
                  </Text>
                </View>
                <Text style={[styles.todayAmount, { color: colors.textPrimary }]}>
                  -{expense.amount.toFixed(0)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {!loading && merged.totalSpent === 0 ? (
        <Card>
          <EmptyState
            icon="create-outline"
            title="No expenses yet"
            message="Start tracking your expenses by adding your first entry"
            actionTitle="Add Your First Expense"
            onAction={() => router.push('/(tabs)/add')}
          />
        </Card>
      ) : null}

      <BottomSheet visible={notificationOpen} onClose={() => setNotificationOpen(false)} title="Notifications">
        <View style={{ gap: spacing.s2 }}>
          {notifications.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.s5, gap: spacing.s2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>No notifications yet</Text>
              <Button
                title="Go to Insights"
                variant="ghost"
                onPress={() => {
                  setNotificationOpen(false);
                  router.push('/(tabs)/insights');
                }}
              />
            </View>
          ) : (
            notifications.map((n) => (
              <View
                key={n.id}
                style={[
                  styles.notification,
                  {
                    backgroundColor:
                      n.type === 'budget-exceeded'
                        ? colors.errorSoft
                        : n.type === 'budget-warning'
                          ? colors.warningSoft
                          : colors.accentSoft,
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>{n.content}</Text>
                {n.meta ? (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 }}>{n.meta}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  homeContent: {
    gap: spacing.s3,
  },
  homeScrollContent: {
    flexGrow: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
  nameAccent: {
    fontSize: 20,
    fontFamily: fonts.medium,
    marginTop: 2,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroCard: {
    borderRadius: 20,
    gap: spacing.s2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroKicker: {
    fontSize: fontSize.xs,
  },
  pacePill: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  heroAmount: {
    fontSize: 32,
    fontFamily: fonts.medium,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: fontSize.xs,
    marginBottom: spacing.s2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  paceMarker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 16,
    marginLeft: -1,
  },
  paceLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  paceLegendText: {
    fontSize: 11,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.s2,
  },
  statTile: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  statValue: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
  },
  insightCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  insightTitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
  },
  insightBody: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 18,
  },
  insightLink: {
    fontSize: fontSize.xs,
    fontFamily: fonts.semibold,
    marginTop: spacing.s2,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.s1,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  sectionMeta: {
    fontSize: 11,
  },
  goalCard: {
    borderRadius: 16,
    gap: spacing.s2,
  },
  goalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalName: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  goalPct: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
  },
  goalTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalFill: {
    height: 6,
    borderRadius: 3,
  },
  goalFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  todayTitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  todayMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  todayAmount: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  notification: {
    padding: spacing.s3,
    borderRadius: radius.md,
  },
});
