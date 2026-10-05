import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProgressBar } from '../../components/charts/ProgressBar';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  budgetContextForMonth,
  budgetPaceLabel,
  budgetSpendTier,
  CATEGORY_BUDGET_INPUT_HINT,
  CATEGORY_BUDGET_INPUT_PLACEHOLDER,
  monthLabel,
} from '../../lib/budgetDashboard';
import { api, getErrorMessage } from '../../lib/api';
import { getCategoryEmoji } from '../../lib/categoryIcons';
import type { BudgetSummary, CategoryBudgetProgress, Expense } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useScreenBack } from '../../lib/hiddenTabNavigation';
import { useAuthStore } from '../../store/authStore';

export default function BudgetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const goBack = useScreenBack('/(tabs)');
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgetProgress[]>([]);
  const [history, setHistory] = useState<BudgetSummary[]>([]);
  const [showPastMonths, setShowPastMonths] = useState(false);

  const [categoryText, setCategoryText] = useState('');
  const [parsedCategories, setParsedCategories] = useState<{ category: string; limit: number }[]>([]);
  const [parsing, setParsing] = useState(false);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editLimitOpen, setEditLimitOpen] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryExpenses, setCategoryExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  const loadBudgets = useCallback(async (m: number, y: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [currentRes, historyRes, categoriesRes] = await Promise.all([
        api.getCurrentBudget({ month: m, year: y }),
        api.getBudgetHistory(12),
        api.getCurrentCategoryBudgets({ month: m, year: y }),
      ]);
      if (currentRes.success) setBudget(currentRes.data);
      if (historyRes.success) setHistory(historyRes.data || []);
      if (categoriesRes.success) setCategoryBudgets(categoriesRes.data || []);
    } catch (err) {
      console.error('Failed to load budgets', err);
    } finally {
      setLoadingBudgets(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBudgets(month, year);
    }, [loadBudgets, month, year])
  );

  const handleSaveLimit = async () => {
    const value = parseFloat(editAmount);
    if (isNaN(value) || value <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.setBudget({ month, year, total_limit: value });
      if (res.success) {
        toast.success('Budget updated');
        setEditLimitOpen(false);
        await loadBudgets(month, year);
      } else {
        toast.error(res.message || 'Failed to save');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!categoryText.trim()) {
      toast.error('Enter category budgets first');
      return;
    }
    setParsing(true);
    try {
      const res = await api.parseCategoryBudgets(categoryText, month, year);
      if (res.success && res.data?.items?.length) {
        setParsedCategories(res.data.items);
        const total = res.data.items.reduce((s, i) => s + i.limit, 0);
        toast.success(`Parsed ${res.data.items.length} categories (${formatCurrency(total, currency)})`);
      } else {
        toast.error('Could not parse any categories');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to parse'));
    } finally {
      setParsing(false);
    }
  };

  const handleSaveCategoryBudgets = async () => {
    const cleaned = parsedCategories
      .map((i) => ({ ...i, limit: Number(i.limit) }))
      .filter((i) => i.category && i.limit > 0);
    if (!cleaned.length) {
      toast.error('No valid budgets to save');
      return;
    }
    try {
      const res = await api.upsertCategoryBudgets({ month, year, items: cleaned });
      if (res.success) {
        toast.success('Category budgets saved');
        setCategoryText('');
        setParsedCategories([]);
        await loadBudgets(month, year);
      } else {
        toast.error(res.message || 'Failed to save');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'));
    }
  };

  const handleSetAsMonthlyLimit = async () => {
    const total = parsedCategories.reduce((s, i) => s + Number(i.limit), 0);
    if (total <= 0) return;
    try {
      await api.setBudget({ month, year, total_limit: total });
      toast.success('Monthly limit set from categories');
      await loadBudgets(month, year);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed'));
    }
  };

  const handleCategoryClick = async (cat: string) => {
    if (expandedCategory === cat) {
      setExpandedCategory(null);
      setCategoryExpenses([]);
      return;
    }
    setExpandedCategory(cat);
    setLoadingExpenses(true);
    try {
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const res = await api.getExpenses({
        startDate: iso(new Date(year, month - 1, 1)),
        endDate: iso(new Date(year, month, 0)),
        category: cat,
        limit: 50,
      });
      if (res.success) setCategoryExpenses(res.data.expenses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const monthYearOptions = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  const budgetPct = budget?.percentage ?? 0;
  const tier = budgetSpendTier(budgetPct);
  const progressColor = tier === 'safe' ? colors.accent : tier === 'warn' ? colors.warning : colors.error;
  const { isCurrentMonth, expectedPct, daysLeft } = budgetContextForMonth(month, year);
  const paceLabel = budgetPaceLabel(budgetPct, expectedPct);
  const safePerDay = budget && daysLeft > 0 ? Math.max(0, budget.remaining) / daysLeft : 0;

  const tierBg =
    tier === 'safe' ? colors.accentSoft : tier === 'warn' ? `${colors.warning}22` : `${colors.error}18`;

  return (
    <Screen
      safeTop
      refreshing={refreshing}
      onRefresh={() => loadBudgets(month, year, true)}
      contentStyle={{ gap: spacing.s3 }}
    >
      <View style={styles.pageHeader}>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>Budget</Text>
          <Pressable onPress={() => setDatePickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{monthLabel(year, month)}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            setEditAmount(budget ? String(budget.total_limit) : '');
            setEditLimitOpen(true);
          }}
          accessibilityLabel="Edit monthly limit"
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
        >
          <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={[styles.heroCard, { borderColor: `${colors.accent}44`, backgroundColor: tierBg }]}>
        {budget ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s2 }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Left this month</Text>
              {isCurrentMonth ? (
                <View style={[styles.paceChip, { backgroundColor: colors.bgCard }]}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontFamily: fonts.semibold }}>{paceLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 32, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
              {loadingBudgets ? '…' : formatCurrency(Math.max(0, budget.remaining), currency)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
              of {formatCurrency(budget.total_limit, currency)}
              {isCurrentMonth && daysLeft > 0 ? ` · ${daysLeft} days left` : ''}
            </Text>
            <View style={{ marginTop: spacing.s3, position: 'relative' }}>
              <ProgressBar percentage={budgetPct} color={progressColor} height={8} />
              {isCurrentMonth ? (
                <View
                  style={[
                    styles.paceMarker,
                    { left: `${Math.min(98, Math.max(0, expectedPct))}%`, backgroundColor: colors.textPrimary },
                  ]}
                />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s2 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                Spent {formatCurrency(budget.total_spent, currency)} ({budgetPct}%)
              </Text>
              {isCurrentMonth ? (
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>Expected {expectedPct}%</Text>
              ) : null}
            </View>
            {isCurrentMonth && daysLeft > 0 ? (
              <View style={[styles.statTile, { backgroundColor: colors.bgCard, marginTop: spacing.s3 }]}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>Safe per day</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.md }}>
                  {formatCurrency(safePerDay, currency)}
                </Text>
              </View>
            ) : null}
          </>
        ) : loadingBudgets ? (
          <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.s4 }}>Loading budget…</Text>
        ) : (
          <View style={{ gap: spacing.s2 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>No monthly limit yet</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18 }}>
              Tap the edit icon to set a total, or describe category limits below and let AI split them.
            </Text>
            <Button title="Set monthly limit" size="sm" onPress={() => setEditLimitOpen(true)} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
      </View>

      <View style={[styles.aiCard, { borderColor: `${colors.accent}44`, backgroundColor: colors.bgCard }]}>
        <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Category budgets</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.s1, lineHeight: 18 }}>
          {CATEGORY_BUDGET_INPUT_HINT}
        </Text>
        <View style={[styles.magicInput, { borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: spacing.s3 }]}>
          <Ionicons name="sparkles" size={18} color={colors.accent} style={{ marginTop: 2 }} />
          <TextInput
            value={categoryText}
            onChangeText={setCategoryText}
            placeholder={CATEGORY_BUDGET_INPUT_PLACEHOLDER}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.categoryBudgetTextArea, { color: colors.textPrimary }]}
            blurOnSubmit={false}
          />
        </View>
        <Button
          title="Parse"
          onPress={handleGenerate}
          loading={parsing}
          disabled={!categoryText.trim()}
          size="sm"
          style={{ alignSelf: 'flex-end', marginTop: spacing.s2 }}
        />

        {parsedCategories.length > 0 ? (
          <View style={{ marginTop: spacing.s3, gap: spacing.s2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.s3 }}>
            <View style={[styles.totalRow, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, flex: 1 }}>
                Total {formatCurrency(parsedCategories.reduce((s, i) => s + Number(i.limit), 0), currency)}
              </Text>
              <Pressable onPress={handleSetAsMonthlyLimit}>
                <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>Use as monthly limit</Text>
              </Pressable>
            </View>
            {parsedCategories.map((item, idx) => (
              <View key={`${item.category}-${idx}`} style={{ flexDirection: 'row', gap: spacing.s2, alignItems: 'center' }}>
                <TextInput
                  value={item.category}
                  onChangeText={(v) => setParsedCategories((prev) => prev.map((p, i) => (i === idx ? { ...p, category: v } : p)))}
                  style={[styles.parsedInput, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]}
                />
                <TextInput
                  value={String(item.limit)}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => setParsedCategories((prev) => prev.map((p, i) => (i === idx ? { ...p, limit: Number(v) || 0 } : p)))}
                  style={[styles.parsedInput, { borderColor: colors.border, color: colors.textPrimary, width: 90, textAlign: 'right' }]}
                />
                <Pressable onPress={() => setParsedCategories((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <Button title="Save category budgets" size="sm" onPress={handleSaveCategoryBudgets} />
          </View>
        ) : null}
      </View>

      {categoryBudgets.length > 0 ? (
        <View style={{ gap: spacing.s2 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: spacing.s1, fontFamily: fonts.medium }}>By category</Text>
          <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            {categoryBudgets.map((b, i) => {
              const pct = b.limit > 0 ? Math.min(100, Math.round((b.spent / b.limit) * 100)) : 0;
              const catTier = budgetSpendTier(pct);
              const barColor = catTier === 'safe' ? colors.accent : catTier === 'warn' ? colors.warning : colors.error;
              const isExpanded = expandedCategory === b.category;
              return (
                <View key={`${b.year}-${b.month}-${b.category}`}>
                  <Pressable
                    onPress={() => handleCategoryClick(b.category)}
                    style={[styles.catRow, i < categoryBudgets.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.emojiBubble, { backgroundColor: colors.inputBg }]}>
                      <Text style={{ fontSize: 18 }}>{getCategoryEmoji(b.category)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s2 }}>
                        <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }} numberOfLines={1}>
                          {b.category}
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>{pct}%</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                        {formatCurrency(b.spent, currency)} of {formatCurrency(b.limit, currency)}
                      </Text>
                      <View style={{ marginTop: spacing.s2 }}>
                        <ProgressBar percentage={pct} color={barColor} height={6} />
                      </View>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </Pressable>
                  {isExpanded ? (
                    <View style={{ paddingHorizontal: spacing.s3, paddingBottom: spacing.s3, gap: spacing.s2 }}>
                      {loadingExpenses ? (
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Loading…</Text>
                      ) : categoryExpenses.length === 0 ? (
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>No transactions this month</Text>
                      ) : (
                        categoryExpenses.map((e) => (
                          <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s2 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, flex: 1 }} numberOfLines={1}>
                              {e.description}
                            </Text>
                            <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, fontFamily: fonts.medium }}>
                              {formatCurrency(e.amount, e.currency)}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {history.length > 0 ? (
        <View>
          <Pressable onPress={() => setShowPastMonths((v) => !v)} style={styles.pastToggle}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Past months ({history.length})</Text>
            <Ionicons name={showPastMonths ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </Pressable>
          {showPastMonths ? (
            <View style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard, marginTop: spacing.s2 }]}>
              {history.slice(0, 6).map((b, i) => {
                const isSelected = b.month === month && b.year === year;
                return (
                  <Pressable
                    key={b.id || `${b.year}-${b.month}`}
                    onPress={() => {
                      setMonth(b.month);
                      setYear(b.year);
                    }}
                    style={[
                      styles.historyRow,
                      i < Math.min(history.length, 6) - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>
                      {monthLabel(b.year, b.month, false)}
                    </Text>
                    <Text style={{ color: b.total_spent <= b.total_limit ? colors.accent : colors.error, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>
                      {b.percentage}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <BottomSheet visible={datePickerOpen} onClose={() => setDatePickerOpen(false)} title="Select month">
        <View style={{ gap: 4 }}>
          {monthYearOptions.map(({ month: m, year: y }) => {
            const isSelected = m === month && y === year;
            return (
              <Pressable
                key={`${y}-${m}`}
                onPress={() => {
                  setMonth(m);
                  setYear(y);
                  setDatePickerOpen(false);
                }}
                style={[styles.monthOption, isSelected && { backgroundColor: colors.accentSoft }]}
              >
                <Text style={{ color: isSelected ? colors.accent : colors.textPrimary, fontSize: fontSize.md, fontFamily: fonts.medium }}>
                  {monthLabel(y, m)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet visible={editLimitOpen} onClose={() => setEditLimitOpen(false)} title="Monthly limit">
        <View style={{ gap: spacing.s3 }}>
          <Input
            label={`Total for ${monthLabel(year, month)} (${currency})`}
            value={editAmount}
            onChangeText={setEditAmount}
            keyboardType="decimal-pad"
            placeholder="Amount"
          />
          <Button title="Save limit" onPress={handleSaveLimit} loading={isSaving} />
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
  backBtn: { marginLeft: -spacing.s1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  paceChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
  },
  paceMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 14,
    marginLeft: -1,
  },
  statTile: {
    borderRadius: radius.md,
    padding: spacing.s3,
  },
  aiCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
  },
  magicInput: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s2,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  categoryBudgetTextArea: {
    flex: 1,
    minHeight: 88,
    maxHeight: 140,
    fontSize: fontSize.sm,
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    borderRadius: radius.md,
    padding: spacing.s2,
  },
  parsedInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    fontSize: fontSize.sm,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s3,
    padding: spacing.s3,
  },
  emojiBubble: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s1,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  monthOption: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    borderRadius: radius.md,
  },
});
