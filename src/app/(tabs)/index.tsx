import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { DonutChart } from '../../components/charts/DonutChart';
import { ProgressBar } from '../../components/charts/ProgressBar';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import { usePendingExpenses } from '../../hooks/usePendingExpenses';
import { addPendingToTotals } from '../../lib/pendingExpenses';
import type { BudgetSummary, CategorySummary, Expense, Goal, Insight } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { usePendingStore } from '../../store/pendingStore';

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
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const pending = usePendingExpenses();
  const isPremium = user?.isPremium ?? false;

  const [summary, setSummary] = useState<CategorySummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);

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
        api.getExpenses({ limit: 5, startDate, endDate }),
        api.getInsights({ limit: 10 }),
        api.getCurrentBudget(),
        api.getGoals().catch(() => null),
      ]);
      if (summaryRes.success) setSummary(summaryRes.data);
      if (expensesRes.success) setRecentExpenses(expensesRes.data.expenses);
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

  // Refetch every time this tab gains focus (covers add/edit/delete flows)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const { startDate, endDate } = getCurrentMonthRange();
  const merged = addPendingToTotals(
    summary?.totalSpent ?? 0,
    summary?.byCategory ?? {},
    pending,
    startDate,
    endDate
  );
  const displaySummary: CategorySummary | null = summary
    ? {
        ...summary,
        totalSpent: merged.totalSpent,
        byCategory: merged.byCategory,
        transactionCount: (summary.transactionCount || 0) + pending.filter((p) => p.date.slice(0, 10) >= startDate && p.date.slice(0, 10) <= endDate).length,
      }
    : pending.length
      ? {
          totalSpent: merged.totalSpent,
          currency: user?.currency || 'USD',
          byCategory: merged.byCategory,
          percentages: {},
          topCategories: Object.keys(merged.byCategory),
          transactionCount: pending.length,
        }
      : null;

  const pendingRecent: Expense[] = pending.map((p) => ({
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
  const displayRecent = [...pendingRecent, ...recentExpenses].slice(0, 5);

  const displayBudget = budget
    ? {
        ...budget,
        total_spent: budget.total_spent + pending.filter((p) => p.date.slice(0, 10) >= startDate && p.date.slice(0, 10) <= endDate).reduce((s, p) => s + p.amount, 0),
      }
    : budget;
  if (displayBudget) {
    displayBudget.remaining = displayBudget.total_limit - displayBudget.total_spent;
    displayBudget.percentage = displayBudget.total_limit > 0 ? Math.round((displayBudget.total_spent / displayBudget.total_limit) * 100) : 0;
  }

  const currency = displaySummary?.currency || user?.currency || 'USD';
  const budgetPct = displayBudget ? displayBudget.percentage : 0;
  const topCategory = Object.entries(merged.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCategoryAmount = topCategory ? merged.byCategory[topCategory] : 0;

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
    const merged = Array.from(new Set([...seenIds, ...notifications.map((n) => n.id)])).slice(-100);
    setSeenIds(merged);
    AsyncStorage.setItem('seen-notifications', JSON.stringify(merged)).catch(() => {});
  };

  const donutFill = Math.min(100, Math.max(0, budgetPct));

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={() => fetchData(true)}>
      {/* Zone A: Personal Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.welcome, { color: colors.textMuted }]}>WELCOME BACK,</Text>
          <Text style={[styles.name, { color: colors.accent }]}>{user?.name || 'User'}</Text>
        </View>
        <Pressable
          onPress={openNotifications}
          style={[styles.bellBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          {unseenCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Budget warning banner */}
      {displayBudget && displayBudget.percentage >= 90 ? (
        <Card
          style={{
            backgroundColor: displayBudget.percentage >= 100 ? colors.errorSoft : 'rgba(217, 119, 6, 0.12)',
            borderColor: displayBudget.percentage >= 100 ? colors.error : colors.warning,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
            {displayBudget.percentage >= 100
              ? 'You have exceeded your monthly budget'
              : 'You are about to exceed your monthly budget'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 4 }}>
            {formatCurrency(displayBudget.total_spent, currency)} of {formatCurrency(displayBudget.total_limit, currency)} (
            {displayBudget.percentage}%)
          </Text>
        </Card>
      ) : null}

      {/* Zone B: Hero card */}
      <Card>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>TOTAL SPENT</Text>
            <Text style={[styles.heroAmount, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {loading ? '…' : formatCurrency(displaySummary?.totalSpent ?? 0, currency)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.s2 }}>
              {displaySummary?.transactionCount ?? 0} transactions
            </Text>
            {displayBudget ? (
              <Text
                style={{
                  color: colors.accent,
                  fontFamily: fonts.semibold,
                  fontSize: fontSize.xs,
                  backgroundColor: colors.accentSoft,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.s2,
                  paddingVertical: 3,
                  alignSelf: 'flex-start',
                  marginTop: spacing.s2,
                  overflow: 'hidden',
                }}
              >
                {formatCurrency(Math.max(0, displayBudget.remaining), currency)} safe to spend
              </Text>
            ) : null}
          </View>
          <DonutChart
            size={96}
            strokeWidth={12}
            centerLabel={`${Math.round(donutFill)}%`}
            centerSubLabel="of budget"
            data={[
              { value: donutFill, color: colors.accent },
              { value: 100 - donutFill, color: colors.border },
            ]}
          />
        </View>
      </Card>

      {/* Zone C: Context grid */}
      <View style={styles.grid}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/budget')}>
          <Card style={styles.gridCard}>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>SAFE TO SPEND</Text>
            <Text style={[styles.gridAmount, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {displayBudget ? formatCurrency(Math.max(0, displayBudget.remaining), currency) : '—'}
            </Text>
            <View style={{ gap: spacing.s1 }}>
              <ProgressBar percentage={budgetPct} />
              <Text style={{ color: colors.accent, fontSize: 10, fontFamily: fonts.semibold }}>View budget</Text>
            </View>
          </Card>
        </Pressable>
        <Card style={[styles.gridCard, { flex: 1 }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>TOP CATEGORY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
            {topCategory ? <CategoryIconBubble category={topCategory} size={40} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }} numberOfLines={1}>
                {topCategory || '—'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: fonts.semibold }} numberOfLines={1}>
                {loading ? '…' : formatCurrency(topCategoryAmount, currency)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* AI advisor entry */}
      <Pressable onPress={() => router.push('/assistant')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
          <View style={[styles.advisorIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="sparkles" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>Ask your AI advisor</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }} numberOfLines={1}>
              Why did I spend so much? How can I save more?
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      </Pressable>

      {/* Savings goals snapshot */}
      {goals.length > 0 ? (
        <View style={{ gap: spacing.s3 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Savings Goals</Text>
            <Pressable onPress={() => router.push('/goals')}>
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>View All</Text>
            </Pressable>
          </View>
          <Card style={{ gap: spacing.s3 }}>
            {goals.slice(0, 2).map((goal) => (
              <Pressable key={goal.id} onPress={() => router.push('/goals')} style={{ gap: spacing.s1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s2 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, flex: 1 }} numberOfLines={1}>
                    {goal.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
                    {formatCurrency(goal.savedAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}
                  </Text>
                </View>
                <ProgressBar percentage={goal.progress * 100} />
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Zone D: Recent transactions */}
      {displayRecent.length > 0 ? (
        <View style={{ gap: spacing.s3 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/(tabs)/expenses')}>
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>View All</Text>
            </Pressable>
          </View>
          <Card padded={false}>
            {displayRecent.map((expense, i) => (
              <Pressable
                key={expense.id}
                onPress={() => router.push('/(tabs)/expenses')}
                style={[
                  styles.txRow,
                  i < displayRecent.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <CategoryIconBubble category={expense.category} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }} numberOfLines={1}>
                    {expense.description}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{formatDate(expense.date)}</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>
                  -{formatCurrency(expense.amount, expense.currency)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Empty state */}
      {!loading && (displaySummary?.transactionCount ?? 0) === 0 ? (
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

      {/* Notifications sheet */}
      <BottomSheet visible={notificationOpen} onClose={() => setNotificationOpen(false)} title="Notifications">
        <View style={{ gap: spacing.s2 }}>
          {notifications.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.s5, gap: spacing.s2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>No notifications yet</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                You’ll see budget alerts and AI insights here
              </Text>
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
                          ? 'rgba(217, 119, 6, 0.12)'
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s2 }}>
            <Pressable
              onPress={() => {
                setNotificationOpen(false);
                router.push('/budget');
              }}
            >
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>View budget</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setNotificationOpen(false);
                router.push('/(tabs)/insights');
              }}
            >
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>View all insights</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcome: {
    fontSize: fontSize.xs,
    fontFamily: fonts.semibold,
    letterSpacing: 1,
  },
  name: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: fonts.bold,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s4,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.s3,
  },
  gridCard: {
    height: 130,
    justifyContent: 'space-between',
  },
  gridAmount: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    padding: spacing.s3,
  },
  notification: {
    padding: spacing.s3,
    borderRadius: radius.md,
  },
  advisorIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
