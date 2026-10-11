import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { pushHiddenTab } from '../../lib/hiddenTabNavigation';
import {
  buildPrimaryInsight,
  buildWeeklySpendingBuckets,
  formatCategoryDelta,
  isBriefingCurrent,
  usualSpendMarkerPct,
  weekKey,
  type CategoryDelta,
} from '../../lib/insightsDashboard';
import { api, getErrorMessage } from '../../lib/api';
import type { BriefingInsight, CategorySummary, Insight, SpendingIntelligence } from '../../lib/types';
import { formatCurrency, getCategoryChartColor } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const TOP_CATEGORIES = 4;
const WEEKLY_CHART_HEIGHT = 84;

interface RecurringItem {
  description: string;
  category: string;
  averageAmount: number;
  currency: string;
  monthsSeen: number;
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
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function deltaColor(tone: 'warn' | 'new' | 'good', colors: ReturnType<typeof useTheme>['colors']): string {
  if (tone === 'warn') return '#f5b84a';
  if (tone === 'new') return '#a78bfa';
  return colors.accent;
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
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<CategorySummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<CategorySummary | null>(null);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [intelligence, setIntelligence] = useState<SpendingIntelligence | null>(null);
  const [briefing, setBriefing] = useState<BriefingInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [briefingUpdating, setBriefingUpdating] = useState(false);
  // Week we already auto-refreshed for, so a user with nothing new to brief isn't retried on every focus.
  const autoRefreshedWeek = useRef<string | null>(null);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const filters = mode === 'month' ? monthRange(selYear, selMonth) : undefined;
      const prevDate = new Date(selYear, selMonth - 2, 1);
      const prevFilters = monthRange(prevDate.getFullYear(), prevDate.getMonth() + 1);
      try {
        const [insightsRes, summaryRes, prevRes, recurringRes, intelligenceRes, briefingRes] = await Promise.all([
          api.getInsights({ limit: 10 }),
          api.getCategorySummary(filters),
          mode === 'month' ? api.getCategorySummary(prevFilters) : Promise.resolve(null),
          api.getRecurringExpenses().catch(() => null),
          api.getIntelligence().catch(() => null),
          api.getLatestBriefing().catch(() => null),
        ]);
        if (insightsRes.success) setInsights(insightsRes.data.insights);
        if (summaryRes.success) setSummary(summaryRes.data);
        setPrevSummary(prevRes?.success ? prevRes.data : null);
        if (recurringRes?.success) setRecurring(recurringRes.data.recurring);
        if (intelligenceRes?.success) setIntelligence(intelligenceRes.data);
        if (briefingRes?.success) {
          const latest = briefingRes.data.briefing;
          setBriefing(latest);
          if (latest && !isBriefingCurrent(latest) && autoRefreshedWeek.current !== weekKey()) {
            autoRefreshedWeek.current = weekKey();
            setBriefingUpdating(true);
            api
              .generateBriefing()
              .then((res) => {
                if (res.success && res.data.briefing) setBriefing(res.data.briefing);
              })
              .catch(() => {})
              .finally(() => setBriefingUpdating(false));
          }
        }
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

  const handleRegenerateInsight = async () => {
    setIsGenerating(true);
    try {
      const [insightsRes, briefingRes] = await Promise.all([
        api.generateInsights(),
        api.generateBriefing().catch(() => null),
      ]);
      if (insightsRes.success) {
        setInsights(insightsRes.data.insights);
        toast.success('Insight refreshed');
      }
      if (briefingRes?.success && briefingRes.data.briefing) {
        setBriefing(briefingRes.data.briefing);
      }
      setInsightDismissed(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to regenerate insight'));
    } finally {
      setIsGenerating(false);
    }
  };

  const barData = useMemo(() => {
    if (!summary || summary.transactionCount === 0) return [];
    return Object.entries(summary.byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [summary]);

  const categoryDeltas = useMemo(() => {
    if (mode !== 'month' || !prevSummary) return {} as Record<string, CategoryDelta>;
    const map: Record<string, CategoryDelta> = {};
    for (const { category, amount } of barData) {
      const prev = prevSummary.byCategory[category];
      if (!prev || prev <= 0) {
        map[category] = amount > 0 ? 'new' : undefined;
      } else {
        map[category] = { pct: Math.round(((amount - prev) / prev) * 100) };
      }
    }
    return map;
  }, [mode, prevSummary, barData]);

  const maxAmount = barData.length > 0 ? Math.max(...barData.map((d) => d.amount)) : 0;
  const visibleBarData = categoriesExpanded ? barData : barData.slice(0, TOP_CATEGORIES);
  const hasMoreCategories = barData.length > TOP_CATEGORIES;

  const primaryInsight = useMemo(
    () => buildPrimaryInsight(insights, briefing, intelligence),
    [insights, briefing, intelligence]
  );

  const weeklyBuckets = useMemo(
    () => buildWeeklySpendingBuckets(briefing, intelligence?.monthlySeries),
    [briefing, intelligence?.monthlySeries]
  );

  const weeklyMax = Math.max(...weeklyBuckets.map((b) => b.amount), 1);
  const topRecurring = recurring[0];

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

  const openAdvisor = () => pushHiddenTab(router, '/assistant', '/(tabs)/insights');

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={() => fetchAll(true)}>
      <View style={styles.pageHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Insights</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>Charts, trends, and AI tips</Text>
        </View>
        <Pressable onPress={openAdvisor} hitSlop={8} style={styles.advisorLink}>
          <Ionicons name="sparkles" size={16} color={colors.accent} />
          <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>AI advisor</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      </View>

      {/* Period row */}
      <View style={styles.periodRow}>
        <View style={styles.periodSegmentWrap}>
          <SegmentedControl
            segments={[
              { value: 'month', label: 'Month' },
              { value: 'all', label: 'All time' },
            ]}
            value={mode}
            onChange={(v) => setMode(v as 'month' | 'all')}
          />
        </View>
        {mode === 'month' ? (
          <Pressable onPress={() => setMonthSheetOpen(true)} style={styles.monthPicker} hitSlop={8}>
            <Text
              style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: fonts.medium }}
              numberOfLines={1}
            >
              {monthLabel(selYear, selMonth)}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Text
            style={[styles.periodSideLabel, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {isPremium ? 'All time' : 'Last 3 mo.'}
          </Text>
        )}
      </View>

      {/* AI insight */}
      {!insightDismissed && primaryInsight ? (
        <Card style={[styles.insightCard, { borderColor: `${colors.accent}66` }]}>
          <View style={styles.insightHeader}>
            <Ionicons name="sparkles" size={16} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>AI insight</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 'auto' }}>
              {briefingUpdating ? 'Updating…' : primaryInsight.updatedLabel}
            </Text>
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontFamily: fonts.medium, marginTop: spacing.s2 }}>
            {primaryInsight.title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.s1 }}>
            {primaryInsight.body}
          </Text>
          <View style={styles.insightActions}>
            <Pressable
              onPress={() => pushHiddenTab(router, '/assistant', '/(tabs)/insights')}
              style={[styles.chipPrimary, { backgroundColor: colors.accent, flex: 1, minWidth: 0 }]}
            >
              <Text style={{ color: '#fff', fontSize: fontSize.sm, fontFamily: fonts.medium }} numberOfLines={1}>
                {primaryInsight.actionLabel
                  ? primaryInsight.actionLabel.length > 24
                    ? `${primaryInsight.actionLabel.slice(0, 24)}…`
                    : primaryInsight.actionLabel
                  : 'Ask advisor'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Regenerate insight"
              onPress={handleRegenerateInsight}
              disabled={isGenerating}
              style={[styles.insightOutlineBtn, { borderColor: colors.border, opacity: isGenerating ? 0.5 : 1 }]}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Hide insight"
              onPress={() => setInsightDismissed(true)}
              style={[styles.insightOutlineBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </Card>
      ) : insightDismissed && primaryInsight ? (
        <Card style={{ paddingVertical: spacing.s3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
            <Ionicons name="sparkles-outline" size={18} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 }}>AI insight hidden</Text>
            <Pressable
              accessibilityLabel="Regenerate insight"
              onPress={handleRegenerateInsight}
              disabled={isGenerating}
              hitSlop={6}
              style={[styles.insightIconBtn, { opacity: isGenerating ? 0.5 : 1 }]}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
              )}
            </Pressable>
            <Pressable
              onPress={() => setInsightDismissed(false)}
              style={[styles.chipOutline, { borderColor: colors.border, marginLeft: 'auto' }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>
                Show insight
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : !primaryInsight && !isLoading ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.s5 }}>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>No AI insight yet for this period.</Text>
          <Button title="Generate insights" onPress={handleRegenerateInsight} loading={isGenerating} style={{ marginTop: spacing.s3 }} />
        </Card>
      ) : null}

      {/* Weekly spending */}
      <Card>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Weekly spending</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Last 4 weeks</Text>
        </View>
        <View style={[styles.weeklyBars, { height: WEEKLY_CHART_HEIGHT }]}>
          {weeklyBuckets.map((bucket) => {
            const h = (bucket.amount / weeklyMax) * WEEKLY_CHART_HEIGHT;
            return (
              <View key={bucket.key} style={styles.weeklyBarCol}>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(h, bucket.amount > 0 ? 4 : 3),
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: bucket.highlight ? colors.accent : colors.border,
                    opacity: bucket.amount > 0 ? 1 : 0.5,
                  }}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.weeklyLabels}>
          {weeklyBuckets.map((bucket) => (
            <Text
              key={`${bucket.key}-amt`}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                color: bucket.highlight ? colors.accent : colors.textMuted,
                fontFamily: bucket.highlight ? fonts.semibold : fonts.regular,
              }}
            >
              {bucket.amount > 0
                ? bucket.amount >= 1000
                  ? `${(bucket.amount / 1000).toFixed(1).replace(/\.0$/, '')}k`
                  : Math.round(bucket.amount).toLocaleString()
                : '0'}
            </Text>
          ))}
        </View>
      </Card>

      {/* Categories vs usual */}
      {summary && summary.transactionCount > 0 && barData.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Categories vs usual</Text>
          <View style={{ gap: spacing.s3, marginTop: spacing.s3 }}>
            {visibleBarData.map((item) => {
              const delta = mode === 'month' ? categoryDeltas[item.category] : undefined;
              const badge = formatCategoryDelta(delta);
              const prev = mode === 'month' && prevSummary ? prevSummary.byCategory[item.category] : undefined;
              const marker = usualSpendMarkerPct(item.amount, prev);
              const barColor =
                badge.tone === 'warn' ? '#f59e0b' : badge.tone === 'new' ? '#8b5cf6' : getCategoryChartColor(item.category);

              return (
                <View key={item.category}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2, marginBottom: spacing.s1 }}>
                    <Text style={{ flex: 1, color: colors.textPrimary, fontSize: fontSize.sm }} numberOfLines={1}>
                      {item.category}
                    </Text>
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                      {formatCurrency(item.amount, summary.currency)}{' '}
                      {mode === 'month' && delta !== undefined ? (
                        <Text style={{ fontSize: fontSize.xs, color: deltaColor(badge.tone, colors) }}>{badge.label}</Text>
                      ) : null}
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={{
                        width: `${maxAmount ? (item.amount / maxAmount) * 100 : 0}%`,
                        height: 6,
                        borderRadius: radius.full,
                        backgroundColor: barColor,
                      }}
                    />
                    {marker !== null && mode === 'month' ? (
                      <View
                        style={[styles.usualTick, { left: `${marker}%`, backgroundColor: colors.textPrimary }]}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
          {hasMoreCategories ? (
            <Pressable onPress={() => setCategoriesExpanded(!categoriesExpanded)} style={{ marginTop: spacing.s3 }}>
              <Text style={{ color: colors.accent, textAlign: 'center', fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                {categoriesExpanded ? 'Show less' : 'View all'}
              </Text>
            </Pressable>
          ) : null}
          {mode === 'month' ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.s3 }}>
              White tick marks your usual monthly amount.
            </Text>
          ) : null}
        </Card>
      ) : summary && summary.transactionCount === 0 && !isLoading ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.s6, gap: spacing.s2 }}>
          <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>No spending this period</Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Pick another month or add expenses.</Text>
        </Card>
      ) : null}

      {/* Recurring — single row */}
      {topRecurring ? (
        <Card style={styles.recurringRow}>
          <Ionicons name="repeat" size={20} color={colors.textMuted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }} numberOfLines={1}>
              {topRecurring.description}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
              Seen {topRecurring.monthsSeen} months, about {formatCurrency(topRecurring.averageAmount, topRecurring.currency)}/mo
            </Text>
          </View>
          <Pressable
            onPress={() => pushHiddenTab(router, '/recurring', '/(tabs)/insights')}
            style={[styles.recurringBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Log automatically</Text>
          </Pressable>
        </Card>
      ) : null}

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
                  {new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </Pressable>
            );
          })}
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
  advisorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: '100%',
    gap: spacing.s2,
    marginBottom: spacing.s2,
  },
  periodSegmentWrap: {
    flex: 1,
    minWidth: 0,
    maxWidth: '62%',
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    maxWidth: '38%',
    gap: 2,
    paddingLeft: spacing.s1,
  },
  periodSideLabel: {
    flexShrink: 0,
    fontSize: fontSize.sm,
    maxWidth: '38%',
  },
  insightCard: {
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  insightIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  insightActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.s2,
    marginTop: spacing.s3,
  },
  chipPrimary: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    minHeight: 38,
    justifyContent: 'center',
  },
  insightOutlineBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOutline: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.s3,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  weeklyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.s3,
  },
  weeklyBarCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  weeklyLabels: {
    flexDirection: 'row',
    gap: spacing.s3,
    marginTop: spacing.s1,
  },
  barTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'visible',
    position: 'relative',
  },
  usualTick: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 12,
    borderRadius: 1,
    marginLeft: -1,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
  recurringBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s2,
    paddingVertical: spacing.s2,
  },
  monthOption: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    borderRadius: radius.md,
  },
});
