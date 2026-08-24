import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DonutChart } from '../../components/charts/DonutChart';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import type { CategorySummary, Insight } from '../../lib/types';
import { formatCurrency, getCategoryChartColor } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const DEFAULT_CATEGORIES_VISIBLE = 5;

export default function InsightsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<CategorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [othersSheetOpen, setOthersSheetOpen] = useState(false);
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const dateRange = useMemo(() => {
    if (period === 'all') return isPremium ? 'All time' : 'Last 3 months (free plan)';
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`;
  }, [period, isPremium]);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const filters =
      period === 'month'
        ? { startDate: iso(startOfMonth(new Date())), endDate: iso(endOfMonth(new Date())) }
        : undefined;
    try {
      const [insightsRes, summaryRes] = await Promise.all([
        api.getInsights({ limit: 10 }),
        api.getCategorySummary(filters),
      ]);
      if (insightsRes.success) setInsights(insightsRes.data.insights);
      if (summaryRes.success) setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    try {
      const response = await api.generateInsights();
      if (response.success) {
        toast.success('Insights generated successfully');
        setInsights(response.data.insights);
        setSummary(response.data.summary);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to generate insights'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Donut data: Top 3 + Others
  const donutData = useMemo(() => {
    if (!summary || summary.transactionCount === 0) return [];
    const sorted = Object.entries(summary.byCategory)
      .map(([name, value]) => ({ name, value, percentage: summary.percentages[name] }))
      .sort((a, b) => b.value - a.value);
    const top3 = sorted.slice(0, 3);
    const others = sorted.slice(3);
    const othersValue = others.reduce((sum, x) => sum + x.value, 0);
    const result = top3.map((s) => ({ name: s.name, value: s.value, percentage: s.percentage }));
    if (othersValue > 0) {
      const othersPct = others.reduce((sum, x) => sum + (parseFloat(x.percentage) || 0), 0);
      result.push({ name: 'Others', value: othersValue, percentage: othersPct.toFixed(1) });
    }
    return result;
  }, [summary]);

  const barData = useMemo(() => {
    if (!summary || summary.transactionCount === 0) return [];
    return Object.entries(summary.byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [summary]);

  const maxAmount = barData.length > 0 ? Math.max(...barData.map((d) => d.amount)) : 0;
  const visibleBarData = categoriesExpanded ? barData : barData.slice(0, DEFAULT_CATEGORIES_VISIBLE);
  const hasMoreCategories = barData.length > DEFAULT_CATEGORIES_VISIBLE;

  const othersBreakdown = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byCategory)
      .map(([name, value]) => ({ name, value, percentage: summary.percentages[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(3);
  }, [summary]);

  const totalLabel =
    summary && summary.totalSpent >= 1000
      ? `${(summary.totalSpent / 1000).toFixed(0)}k`
      : `${Math.round(summary?.totalSpent ?? 0)}`;

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={() => fetchAll(true)}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Spending Analysis</Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>{dateRange}</Text>
        </View>
        <Button title="Refresh" variant="ghost" size="sm" onPress={handleGenerateInsights} loading={isGenerating} />
      </View>

      {/* Period switcher */}
      <SegmentedControl
        segments={[
          { value: 'month', label: 'This month' },
          { value: 'all', label: 'All time' },
        ]}
        value={period}
        onChange={(v) => setPeriod(v as 'month' | 'all')}
      />

      {/* Big picture donut */}
      {summary && summary.transactionCount > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
            <DonutChart
              size={140}
              strokeWidth={20}
              centerLabel={totalLabel}
              data={donutData.map((d) => ({
                value: d.value,
                color: d.name === 'Others' ? '#9CA3AF' : getCategoryChartColor(d.name),
              }))}
            />
            <View style={{ flex: 1, gap: spacing.s2 }}>
              {donutData.map((entry) => {
                const isOthers = entry.name === 'Others' && othersBreakdown.length > 0;
                return (
                  <Pressable
                    key={entry.name}
                    onPress={isOthers ? () => setOthersSheetOpen(true) : undefined}
                    style={styles.legendRow}
                  >
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: entry.name === 'Others' ? '#9CA3AF' : getCategoryChartColor(entry.name) },
                      ]}
                    />
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, flex: 1 }} numberOfLines={1}>
                      {entry.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{entry.percentage}%</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>
      ) : null}

      {/* Top spending categories */}
      {summary && summary.transactionCount > 0 && barData.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Spending Categories</Text>
          <View style={{ gap: spacing.s3, marginTop: spacing.s3 }}>
            {visibleBarData.map((item) => (
              <View key={item.category} style={{ gap: spacing.s1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }} numberOfLines={1}>
                    {item.category}
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                    {formatCurrency(item.amount, summary.currency)}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={{
                      width: `${maxAmount ? (item.amount / maxAmount) * 100 : 0}%`,
                      backgroundColor: getCategoryChartColor(item.category),
                      height: 8,
                      borderRadius: radius.full,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
          {hasMoreCategories ? (
            <Pressable onPress={() => setCategoriesExpanded(!categoriesExpanded)} style={{ marginTop: spacing.s3 }}>
              <Text style={{ color: colors.accent, textAlign: 'center', fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                {categoriesExpanded ? 'View Less' : 'View All'}
              </Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {/* Premium locked (free users) */}
      {!isPremium ? (
        <Card style={{ alignItems: 'center', borderStyle: 'dashed', borderWidth: 2 }}>
          <View style={[styles.lockCircle, { backgroundColor: colors.border }]}>
            <Ionicons name="lock-closed" size={22} color={colors.textMuted} />
          </View>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, marginTop: spacing.s2 }}>
            Daily & Weekly Insights
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center', marginTop: 4 }}>
            Get granular spending patterns with daily and weekly AI analysis on Premium.
          </Text>
          <Button title="Upgrade to Premium" onPress={() => router.push('/premium')} style={{ marginTop: spacing.s3 }} />
        </Card>
      ) : null}

      {/* AI observations */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>AI Observations</Text>
        {isLoading ? (
          <Text style={{ color: colors.textSecondary, paddingVertical: spacing.s5, textAlign: 'center' }}>
            Loading insights…
          </Text>
        ) : insights.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.s5, gap: spacing.s2 }}>
            <Text style={{ fontSize: 40 }}>💡</Text>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.lg }}>No insights yet</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
              Generate insights to get AI-powered analysis of your spending
            </Text>
            <Button title="Generate Insights" onPress={handleGenerateInsights} loading={isGenerating} />
          </View>
        ) : (
          <View style={{ gap: spacing.s3, marginTop: spacing.s3 }}>
            {insights.map((insight) => {
              const isAttention =
                insight.type === 'warning' || insight.type.toLowerCase().includes('attention') || insight.type.toLowerCase().includes('high');
              const tint = isAttention ? colors.warning : '#3B82F6';
              return (
                <View key={insight.id} style={[styles.insightCard, { borderColor: tint, backgroundColor: colors.bgCard }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2, marginBottom: spacing.s2 }}>
                    <Ionicons name={isAttention ? 'warning' : 'information-circle'} size={18} color={tint} />
                    <View style={[styles.tag, { backgroundColor: `${tint}30` }]}>
                      <Text style={{ color: tint, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>
                        {isAttention ? 'ATTENTION' : 'INSIGHT'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>
                    {insight.content}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Others breakdown sheet */}
      <BottomSheet visible={othersSheetOpen} onClose={() => setOthersSheetOpen(false)} title="Other Categories">
        {summary && othersBreakdown.length > 0 ? (
          <View style={{ gap: spacing.s2 }}>
            {othersBreakdown.map((item) => (
              <View key={item.name} style={[styles.othersRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
                  {formatCurrency(item.value, summary.currency)} ({item.percentage}%)
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>No other categories</Text>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s3,
  },
  tag: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
  },
  othersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.s3,
  },
});
