import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { DonutChart } from '../../components/charts/DonutChart';
import { ProgressBar } from '../../components/charts/ProgressBar';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Screen } from '../../components/ui/Screen';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import type { BudgetSummary, CategorySummary, Expense, Insight } from '../../lib/types';
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
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  const [summary, setSummary] = useState<CategorySummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    const { startDate, endDate } = getCurrentMonthRange();
    if (isRefresh) setRefreshing(true);
    try {
      const [summaryRes, expensesRes, insightsRes, budgetRes] = await Promise.all([
        api.getCategorySummary({ startDate, endDate }),
        api.getExpenses({ limit: 5, startDate, endDate }),
        api.getInsights({ limit: 10 }),
        api.getCurrentBudget(),
      ]);
      if (summaryRes.success) setSummary(summaryRes.data);
      if (expensesRes.success) setRecentExpenses(expensesRes.data.expenses);
      if (insightsRes.success) setInsights(insightsRes.data.insights);
      if (budgetRes.success) setBudget(budgetRes.data);
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

  const currency = summary?.currency || user?.currency || 'USD';
  const budgetPct = budget ? budget.percentage : 0;
  const topCategory = summary?.topCategories?.[0];
  const topCategoryAmount = topCategory ? (summary?.byCategory?.[topCategory] ?? 0) : 0;

  const notifications: NotificationItem[] = [];
  if (budget && budget.percentage >= 100) {
    notifications.push({
      id: 'budget-exceeded',
      type: 'budget-exceeded',
      content: 'You have exceeded your monthly budget',
      meta: `${formatCurrency(budget.total_spent, currency)} of ${formatCurrency(budget.total_limit, currency)} (${budget.percentage}%)`,
    });
  } else if (budget && budget.percentage >= 90) {
    notifications.push({
      id: 'budget-warning',
      type: 'budget-warning',
      content: 'You are about to exceed your monthly budget',
      meta: `${formatCurrency(budget.total_spent, currency)} of ${formatCurrency(budget.total_limit, currency)} (${budget.percentage}%)`,
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

  const donutFill = Math.min(100, Math.max(0, budgetPct));

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchData(true)}>
      {/* Zone A: Personal Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.welcome, { color: colors.textMuted }]}>WELCOME BACK,</Text>
          <Text style={[styles.name, { color: colors.accent }]}>{user?.name || 'User'}</Text>
        </View>
        <Pressable
          onPress={() => setNotificationOpen(true)}
          style={[styles.bellBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          {notifications.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{notifications.length > 9 ? '9+' : notifications.length}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Budget warning banner */}
      {budget && budget.percentage >= 90 ? (
        <Card
          style={{
            backgroundColor: budget.percentage >= 100 ? colors.errorSoft : 'rgba(217, 119, 6, 0.12)',
            borderColor: budget.percentage >= 100 ? colors.error : colors.warning,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.sm }}>
            {budget.percentage >= 100
              ? 'You have exceeded your monthly budget'
              : 'You are about to exceed your monthly budget'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 4 }}>
            {formatCurrency(budget.total_spent, currency)} of {formatCurrency(budget.total_limit, currency)} (
            {budget.percentage}%)
          </Text>
        </Card>
      ) : null}

      {/* Zone B: Hero card */}
      <Card>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>TOTAL SPENT</Text>
            <Text style={[styles.heroAmount, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {loading ? '…' : formatCurrency(summary?.totalSpent ?? 0, currency)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.s2 }}>
              {summary?.transactionCount ?? 0} transactions
            </Text>
          </View>
          <DonutChart
            size={96}
            strokeWidth={12}
            centerLabel={`${Math.round(donutFill)}%`}
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
              {budget ? formatCurrency(Math.max(0, budget.remaining), currency) : '—'}
            </Text>
            <View style={{ gap: spacing.s1 }}>
              <ProgressBar percentage={budgetPct} />
              <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '600' }}>View budget</Text>
            </View>
          </Card>
        </Pressable>
        <Card style={[styles.gridCard, { flex: 1 }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>TOP CATEGORY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
            {topCategory ? <CategoryIconBubble category={topCategory} size={40} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>
                {topCategory || '—'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' }} numberOfLines={1}>
                {loading ? '…' : formatCurrency(topCategoryAmount, currency)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Zone D: Recent transactions */}
      {recentExpenses.length > 0 ? (
        <View style={{ gap: spacing.s3 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/(tabs)/expenses')}>
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: fontSize.sm }}>View All</Text>
            </Pressable>
          </View>
          <Card padded={false}>
            {recentExpenses.map((expense, i) => (
              <Pressable
                key={expense.id}
                onPress={() => router.push('/(tabs)/expenses')}
                style={[
                  styles.txRow,
                  i < recentExpenses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <CategoryIconBubble category={expense.category} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>
                    {expense.description}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{formatDate(expense.date)}</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                  -{formatCurrency(expense.amount, expense.currency)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Empty state */}
      {!loading && (summary?.transactionCount ?? 0) === 0 ? (
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

      {/* Ad placeholder (free users) */}
      {!isPremium && !loading ? (
        <Card style={{ alignItems: 'center', borderStyle: 'dashed' }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Ad · Upgrade to Premium to remove ads</Text>
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
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' }}>{n.content}</Text>
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
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: fontSize.sm }}>View budget</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setNotificationOpen(false);
                router.push('/(tabs)/insights');
              }}
            >
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: fontSize.sm }}>View all insights</Text>
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
    fontWeight: '600',
    letterSpacing: 1,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s4,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
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
});
