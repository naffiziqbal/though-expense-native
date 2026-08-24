import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DonutChart } from '../../components/charts/DonutChart';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import type { CategorySummary, Insight } from '../../lib/types';
import { formatCurrency, getCategoryChartColor } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const DEFAULT_CATEGORIES_VISIBLE = 5;

interface RecurringItem {
  description: string;
  category: string;
  averageAmount: number;
  currency: string;
  occurrences: number;
  monthsSeen: number;
  lastDate: string;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthRange(year: number, month: number): { startDate: string; endDate: string } {
  return {
    startDate: iso(new Date(year, month - 1, 1)),
    endDate: iso(new Date(year, month, 0)),
  };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  const now = new Date();
  const [mode, setMode] = useState<'month' | 'all'>('month');
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<CategorySummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<CategorySummary | null>(null);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [othersSheetOpen, setOthersSheetOpen] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const dateLabel = mode === 'all' ? (isPremium ? 'All time' : 'Last 3 months (free plan)') : monthLabel(selYear, selMonth);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const filters = mode === 'month' ? monthRange(selYear, selMonth) : undefined;
      // Previous month for deltas (month view only)
      const prevDate = new Date(selYear, selMonth - 2, 1);
      const prevFilters = monthRange(prevDate.getFullYear(), prevDate.getMonth() + 1);
      try {
        const [insightsRes, summaryRes, prevRes, recurringRes] = await Promise.all([
          api.getInsights({ limit: 10 }),
          api.getCategorySummary(filters),
          mode === 'month' ? api.getCategorySummary(prevFilters) : Promise.resolve(null),
          api.getRecurringExpenses().catch(() => null),
        ]);
        if (insightsRes.success) setInsights(insightsRes.data.insights);
        if (summaryRes.success) setSummary(summaryRes.data);
        setPrevSummary(prevRes?.success ? prevRes.data : null);
        if (recurringRes?.success) setRecurring(recurringRes.data.recurring);
      } catch (error) {
        console.error('Failed to fetch insights:', error);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [mode, selYear, selMonth]
  );

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

  /** Month-over-month delta per category: pct change, or 'new' */
  const deltas = useMemo(() => {
    if (mode !== 'month' || !prevSummary) return {};
    const map: Record<string, { pct: number } | 'new'> = {};
    for (const { category, amount } of barData) {
      const prev = prevSummary.byCategory[category];
      if (!prev || prev <= 0) {
        map[category] = 'new';
      } else {
        map[category] = { pct: Math.round(((amount - prev) / prev) * 100) };
      }
    }
    return map;
  }, [mode, prevSummary, barData]);

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

  // last 24 months for the picker
  const monthYearOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        return { month: d.getMonth() + 1, year: d.getFullYear() };
      }),
    []
  );

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={() => fetchAll(true)}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Spending Analysis</Text>
          {mode === 'month' ? (
            <Pressable
              onPress={() => setMonthSheetOpen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                {dateLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>{dateLabel}</Text>
          )}
        </View>
        <Button title="Refresh" variant="ghost" size="sm" onPress={handleGenerateInsights} loading={isGenerating} />
      </View>

      {/* Period switcher */}
      <SegmentedControl
        segments={[
          { value: 'month', label: 'Monthly' },
          { value: 'all', label: 'All time' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'month' | 'all')}
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

      {/* Empty state for the selected period */}
      {summary && summary.transactionCount === 0 && !isLoading ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.s6, gap: spacing.s2 }}>
          <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>No spending in {dateLabel}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Pick another month or add expenses.</Text>
        </Card>
      ) : null}

      {/* Top spending categories with MoM deltas */}
      {summary && summary.transactionCount > 0 && barData.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Spending Categories</Text>
          <View style={{ gap: spacing.s3, marginTop: spacing.s3 }}>
            {visibleBarData.map((item) => {
              const delta = deltas[item.category];
              return (
                <View key={item.category} style={{ gap: spacing.s1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
                    <Text
                      style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium, flex: 1 }}
                      numberOfLines={1}
                    >
                      {item.category}
                    </Text>
                    {delta === 'new' ? (
                      <Text style={[styles.deltaChip, { color: colors.accent, backgroundColor: colors.accentSoft }]}>
                        new
                      </Text>
                    ) : delta && delta.pct !== 0 ? (
                      <Text
                        style={[
                          styles.deltaChip,
                          delta.pct > 0
                            ? { color: colors.error, backgroundColor: colors.errorSoft }
                            : { color: colors.success, backgroundColor: colors.accentSoft },
                        ]}
                      >
                        {delta.pct > 0 ? '↑' : '↓'}
                        {Math.abs(delta.pct)}% vs prev
                      </Text>
                    ) : null}
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
              );
            })}
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

      {/* Recurring expenses */}
      {recurring.length > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
            <Ionicons name="repeat" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recurring</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
            Detected from your history — likely subscriptions & bills
          </Text>
          <View style={{ gap: spacing.s3, marginTop: spacing.s3 }}>
            {recurring.map((item) => (
              <View key={item.description} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                    {item.category} · seen {item.monthsSeen} months
                  </Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                  ~{formatCurrency(item.averageAmount, item.currency)}/mo
                </Text>
              </View>
            ))}
          </View>
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
            <Ionicons name="bulb-outline" size={36} color={colors.textMuted} />
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
                insight.type === 'warning' ||
                insight.type.toLowerCase().includes('attention') ||
                insight.type.toLowerCase().includes('high');
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

      {/* Month picker sheet */}
      <BottomSheet visible={monthSheetOpen} onClose={() => setMonthSheetOpen(false)} title="Select month">
        <View style={{ gap: 4 }}>
          {monthYearOptions.map(({ month: m, year: y }) => {
            const isSelected = m === selMonth && y === selYear;
            return (
              <Pressable
                key={`${y}-${m}`}
                onPress={() => {
                  setSelMonth(m);
                  setSelYear(y);
                  setMonthSheetOpen(false);
                }}
                style={[styles.monthOption, isSelected && { backgroundColor: colors.accentSoft }]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.accent : colors.textPrimary,
                    fontSize: fontSize.md,
                    fontFamily: fonts.medium,
                  }}
                >
                  {monthLabel(y, m)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

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
  deltaChip: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
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
  monthOption: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    borderRadius: radius.md,
  },
});
