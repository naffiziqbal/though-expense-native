import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProgressBar } from '../components/charts/ProgressBar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import { getCategoryEmoji } from '../lib/categoryIcons';
import type { BudgetSummary, CategoryBudgetProgress, Expense } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

function monthLabel(year: number, month: number, long = true): string {
  return new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: long ? 'long' : 'short',
    year: 'numeric',
  });
}

export default function BudgetScreen() {
  const { colors } = useTheme();
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

  const loadBudgets = useCallback(
    async (m: number, y: number, isRefresh = false) => {
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
    },
    []
  );

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
        toast.success(`Parsed ${res.data.items.length} categories (Total: ${formatCurrency(total, currency)})`);
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

  // last 24 months for picker
  const monthYearOptions = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  const budgetPct = budget?.percentage ?? 0;
  const progressColor = budgetPct < 75 ? colors.accent : budgetPct < 95 ? colors.warning : colors.error;

  return (
    <Screen refreshing={refreshing} onRefresh={() => loadBudgets(month, year, true)}>
      {/* Month selector */}
      <Pressable onPress={() => setDatePickerOpen(true)} style={styles.monthRow}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
          {monthLabel(year, month)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      {/* Scoreboard */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '500' }}>Safe to Spend</Text>
            <Text
              style={{ color: colors.textPrimary, fontSize: 40, fontWeight: '800', opacity: loadingBudgets ? 0.5 : 1 }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {loadingBudgets ? '…' : budget ? formatCurrency(Math.max(0, budget.remaining), currency) : '—'}
            </Text>
          </View>
          <Pressable onPress={() => { setEditAmount(budget ? String(budget.total_limit) : ''); setEditLimitOpen(true); }} hitSlop={8}>
            <Ionicons name="pencil" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        {budget ? (
          <View style={{ marginTop: spacing.s3, gap: spacing.s2 }}>
            <ProgressBar percentage={budgetPct} color={progressColor} height={12} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500' }}>
                {formatCurrency(budget.total_spent, currency)} spent
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500' }}>
                {formatCurrency(budget.total_limit, currency)} limit
              </Text>
            </View>
          </View>
        ) : !loadingBudgets ? (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.s3 }}>
            Set a total limit using the pencil icon, or generate from category budgets below.
          </Text>
        ) : null}
      </Card>

      {/* Magic wand: AI category budgets */}
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.s2, alignItems: 'center' }}>
          <View style={[styles.magicInput, { borderColor: colors.border, backgroundColor: colors.bgSurface }]}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <TextInput
              value={categoryText}
              onChangeText={setCategoryText}
              placeholder="e.g. Food 500, Rent 2000, Gas 100..."
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, paddingVertical: spacing.s2 }}
              onSubmitEditing={handleGenerate}
            />
          </View>
          <Button title="Generate" onPress={handleGenerate} loading={parsing} disabled={!categoryText.trim()} size="sm" />
        </View>

        {parsedCategories.length > 0 ? (
          <View style={{ marginTop: spacing.s3, gap: spacing.s2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.s3 }}>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500' }}>Review & save</Text>
            <View style={[styles.totalRow, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, flex: 1 }}>
                Total from categories: {formatCurrency(parsedCategories.reduce((s, i) => s + Number(i.limit), 0), currency)}
              </Text>
              <Pressable onPress={handleSetAsMonthlyLimit}>
                <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: '600' }}>Set as monthly limit</Text>
              </Pressable>
            </View>
            {parsedCategories.map((item, idx) => (
              <View key={`${item.category}-${idx}`} style={{ flexDirection: 'row', gap: spacing.s2, alignItems: 'center' }}>
                <TextInput
                  value={item.category}
                  onChangeText={(v) =>
                    setParsedCategories((prev) => prev.map((p, i) => (i === idx ? { ...p, category: v } : p)))
                  }
                  style={[styles.parsedInput, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]}
                />
                <TextInput
                  value={String(item.limit)}
                  keyboardType="decimal-pad"
                  onChangeText={(v) =>
                    setParsedCategories((prev) => prev.map((p, i) => (i === idx ? { ...p, limit: Number(v) || 0 } : p)))
                  }
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
      </Card>

      {/* Breakdown */}
      {categoryBudgets.length > 0 ? (
        <View style={{ gap: spacing.s2 }}>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' }}>Breakdown</Text>
          {categoryBudgets.map((b) => {
            const pct = b.limit > 0 ? Math.min(100, Math.round((b.spent / b.limit) * 100)) : 0;
            const barColor = pct < 75 ? colors.accent : pct < 95 ? colors.warning : colors.error;
            const isExpanded = expandedCategory === b.category;
            return (
              <Card key={`${b.year}-${b.month}-${b.category}`}>
                <Pressable onPress={() => handleCategoryClick(b.category)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s3 }}>
                  <View style={[styles.emojiBubble, { backgroundColor: colors.bgSurface }]}>
                    <Text style={{ fontSize: 20 }}>{getCategoryEmoji(b.category)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md }}>{b.category}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500' }}>
                      {formatCurrency(b.spent, currency)} / {formatCurrency(b.limit, currency)}
                    </Text>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </Pressable>
                <View style={{ marginTop: spacing.s2 }}>
                  <ProgressBar percentage={pct} color={barColor} height={6} />
                </View>
                {isExpanded ? (
                  <View style={{ marginTop: spacing.s3, paddingTop: spacing.s3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.s2 }}>
                    {loadingExpenses ? (
                      <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>Loading…</Text>
                    ) : categoryExpenses.length === 0 ? (
                      <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>No transactions this month</Text>
                    ) : (
                      categoryExpenses.map((e) => (
                        <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 }} numberOfLines={1}>
                            {e.description}
                          </Text>
                          <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' }}>
                            {formatCurrency(e.amount, e.currency)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Past months */}
      {history.length > 0 ? (
        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', marginBottom: spacing.s2 }}>
            Past months
          </Text>
          {history.slice(0, 6).map((b) => {
            const isSelected = b.month === month && b.year === year;
            return (
              <Pressable
                key={b.id || `${b.year}-${b.month}`}
                onPress={() => {
                  setMonth(b.month);
                  setYear(b.year);
                }}
                style={[styles.historyRow, isSelected && { backgroundColor: colors.accentSoft, borderRadius: radius.md }]}
              >
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' }}>
                  {monthLabel(b.year, b.month, false)} {isSelected ? '(viewing)' : ''}
                </Text>
                <Text
                  style={{
                    color: b.total_spent <= b.total_limit ? colors.accent : colors.error,
                    fontSize: fontSize.xs,
                    fontWeight: '600',
                  }}
                >
                  {b.percentage}%
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* Month picker sheet */}
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
                <Text style={{ color: isSelected ? colors.accent : colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' }}>
                  {monthLabel(y, m)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* Edit limit sheet */}
      <BottomSheet visible={editLimitOpen} onClose={() => setEditLimitOpen(false)} title="Edit total budget">
        <View style={{ gap: spacing.s3 }}>
          <Input
            label="Total monthly limit"
            value={editAmount}
            onChangeText={setEditAmount}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            hint={`${monthLabel(year, month)} · Your currency: ${currency}`}
          />
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setEditLimitOpen(false)} />
            <Button title="Save" style={{ flex: 1 }} onPress={handleSaveLimit} loading={isSaving} />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  magicInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s3,
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
  emojiBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
