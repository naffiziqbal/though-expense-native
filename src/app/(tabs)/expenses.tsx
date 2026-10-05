import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTabScreenTopPadding } from '../../hooks/useSafeTop';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryInput } from '../../components/ui/CategoryInput';
import { DateField } from '../../components/ui/DateField';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { fonts, fontSize, radius, spacing, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { isCurrentlyOffline } from '../../hooks/useOutboxSync';
import { api, getErrorMessage, isUnreachableError } from '../../lib/api';
import {
  formatCacheAge,
  readCategoryCache,
  readExpenseCache,
  writeCategoryCache,
  writeExpenseCache,
} from '../../lib/expenseCache';
import { saveExportedFile } from '../../lib/exportFile';
import type { Expense, SearchResultExpense } from '../../lib/types';
import { groupExpensesByDay, type ExpenseDaySection } from '../../lib/homeDashboard';
import { cleanExpenseDescription, formatCurrency, formatExpenseAmountParts } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { usePendingExpenses } from '../../hooks/usePendingExpenses';

/** Server max is 100; smaller pages feel smoother while scrolling. */
const PAGE_SIZE = 40;

type ExpenseRowItem = Pick<Expense, 'id' | 'description' | 'amount' | 'currency' | 'category' | 'date'>;

function appendExpenses(prev: Expense[], batch: Expense[]): Expense[] {
  if (!batch.length) return prev;
  const seen = new Set(prev.map((e) => e.id));
  const next = batch.filter((e) => !seen.has(e.id));
  return next.length ? [...prev, ...next] : prev;
}

const ExpenseListRow = React.memo(function ExpenseListRow({
  item,
  onPress,
  showDivider,
  colors,
}: {
  item: ExpenseRowItem;
  onPress: () => void;
  showDivider: boolean;
  colors: ThemeColors;
}) {
  const { code, value } = formatExpenseAmountParts(item.amount, item.currency);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.txRow,
        showDivider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}
    >
      <CategoryIconBubble category={item.category} size={40} />
      <View style={styles.txMain}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {cleanExpenseDescription(item.description)}
        </Text>
        <Text style={[styles.txCategory, { color: colors.textMuted }]} numberOfLines={1}>
          {item.category}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txCurrency, { color: colors.textMuted }]}>{code}</Text>
        <Text style={[styles.txAmount, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </Pressable>
  );
});

const ExpenseDayBlock = React.memo(function ExpenseDayBlock({
  section,
  colors,
  onPressRow,
}: {
  section: ExpenseDaySection;
  colors: ThemeColors;
  onPressRow: (item: ExpenseRowItem) => void;
}) {
  const { code, value } = formatExpenseAmountParts(section.total, section.currency);
  return (
    <View style={styles.dayBlock}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{section.label}</Text>
        <View style={styles.dayTotalCol}>
          <Text style={[styles.txCurrency, { color: colors.textMuted }]}>{code}</Text>
          <Text style={[styles.dayTotal, { color: colors.textPrimary }]}>{value}</Text>
        </View>
      </View>
      <Card padded={false} style={styles.dayCard}>
        {section.data.map((item, index) => (
          <ExpenseListRow
            key={item.id}
            item={item}
            colors={colors}
            showDivider={index < section.data.length - 1}
            onPress={() => onPressRow(item)}
          />
        ))}
      </Card>
    </View>
  );
});

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const tabTopPadding = useTabScreenTopPadding();
  const { user } = useAuthStore();
  const pending = usePendingExpenses();
  const isPremium = user?.isPremium ?? false;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [showingCached, setShowingCached] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState<number | null>(null);

  // Natural-language search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultExpense[] | null>(null);
  const [searchTotalAmount, setSearchTotalAmount] = useState(0);
  const [searchCurrency, setSearchCurrency] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const [filters, setFilters] = useState({ category: '', startDate: '', endDate: '' });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);

  // Edit / delete
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [editForm, setEditForm] = useState({ description: '', amount: '', category: '', date: '' });

  // Export
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const minDateFree = isoDaysAgo(90);
  const firstFocus = useRef(true);
  const fetchGen = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const expensesLengthRef = useRef(0);
  const prevFiltersKey = useRef<string | null>(null);

  const filtersKey = useMemo(
    () => `${filters.category}|${filters.startDate}|${filters.endDate}`,
    [filters.category, filters.endDate, filters.startDate]
  );

  useEffect(() => {
    expensesLengthRef.current = expenses.length;
  }, [expenses.length]);

  const fetchPage = useCallback(
    async (mode: 'refresh' | 'append', activeFilters: typeof filters) => {
      const userId = user?.id;
      const cacheFilters = {
        category: activeFilters.category,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate,
      };

      let refreshGen = 0;
      let cached: Awaited<ReturnType<typeof readExpenseCache>> = null;

      if (mode === 'refresh') {
        refreshGen = ++fetchGen.current;
        cached = userId ? await readExpenseCache(userId, 1, cacheFilters) : null;
        if (refreshGen !== fetchGen.current) return;

        if (cached && expensesLengthRef.current === 0) {
          setExpenses(cached.expenses);
          setTotal(cached.total);
          hasMoreRef.current = cached.expenses.length < cached.total;
          setShowingCached(true);
          setCacheSavedAt(cached.savedAt);
          setIsLoading(false);
        } else if (expensesLengthRef.current === 0) {
          setIsLoading(true);
        }
      } else {
        if (loadingMoreRef.current || isLoading || !hasMoreRef.current) return;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
      }

      const appendGen = fetchGen.current;
      const offset = mode === 'refresh' ? 0 : expensesLengthRef.current;

      try {
        const startDate =
          activeFilters.startDate && !isPremium && activeFilters.startDate < minDateFree
            ? minDateFree
            : activeFilters.startDate;
        const response = await api.getExpenses({
          ...(activeFilters.category && { category: activeFilters.category }),
          ...(startDate && { startDate }),
          ...(activeFilters.endDate && { endDate: activeFilters.endDate }),
          limit: PAGE_SIZE,
          offset,
        });

        if (mode === 'refresh') {
          if (refreshGen !== fetchGen.current) return;
        } else if (appendGen !== fetchGen.current) {
          return;
        }

        if (response.success) {
          const batch = response.data.expenses;
          hasMoreRef.current = response.data.pagination.hasMore;
          setTotal(response.data.pagination.total);
          setShowingCached(false);
          setCacheSavedAt(null);

          if (mode === 'refresh') {
            setExpenses(batch);
            if (userId) {
              await writeExpenseCache(userId, 1, cacheFilters, {
                expenses: batch,
                total: response.data.pagination.total,
                categories: [],
              });
            }
          } else {
            setExpenses((prev) => appendExpenses(prev, batch));
          }
        }
      } catch (error) {
        if (mode === 'refresh') {
          if (refreshGen !== fetchGen.current) return;
          if (cached) return;
          setExpenses([]);
          setTotal(0);
          hasMoreRef.current = false;
          const unreachable = isUnreachableError(error) || (await isCurrentlyOffline());
          setShowingCached(unreachable);
          setCacheSavedAt(null);
          if (!unreachable) toast.error('Failed to fetch expenses');
        }
      } finally {
        if (mode === 'refresh') {
          if (refreshGen === fetchGen.current) setIsLoading(false);
        } else {
          loadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      }
    },
    [isLoading, isPremium, minDateFree, user?.id]
  );

  const loadMore = useCallback(() => {
    void fetchPage('append', filters);
  }, [fetchPage, filters]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    hasMoreRef.current = true;
    await fetchPage('refresh', filters);
    setRefreshing(false);
  }, [fetchPage, filters]);

  const fetchCategories = useCallback(async () => {
    const userId = user?.id;
    if (userId) {
      const cached = await readCategoryCache(userId);
      if (cached.length) setCategories(cached);
    }
    try {
      const res = await api.getCategorySummary();
      if (res.success && res.data.byCategory) {
        const next = Object.keys(res.data.byCategory);
        setCategories(next);
        if (userId) await writeCategoryCache(userId, next);
      }
    } catch {
      // keep whatever we hydrated from cache
    }
  }, [user?.id]);

  useEffect(() => {
    if (prevFiltersKey.current === null) {
      prevFiltersKey.current = filtersKey;
      return;
    }
    if (prevFiltersKey.current === filtersKey) return;
    prevFiltersKey.current = filtersKey;
    fetchGen.current += 1;
    hasMoreRef.current = true;
    setExpenses([]);
    expensesLengthRef.current = 0;
    void fetchPage('refresh', filters);
  }, [fetchPage, filters, filtersKey]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        void fetchCategories();
        void fetchPage('refresh', filters);
      }
    }, [fetchCategories, fetchPage, filters])
  );

  useEffect(() => {
    if (filterSheetOpen) setDraftFilters(filters);
  }, [filterSheetOpen, filters]);

  const handleEdit = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setEditForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date.split('T')[0],
    });
    setEditSheetOpen(true);
  }, []);

  const handlePressRow = useCallback(
    (item: ExpenseRowItem) => {
      if (item.id.startsWith('pending:')) return;
      handleEdit(item as Expense);
    },
    [handleEdit]
  );

  const handleSaveEdit = async () => {
    if (!selectedExpense) return;
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      const response = await api.updateExpense(selectedExpense.id, {
        description: editForm.description,
        amount,
        category: editForm.category,
        date: new Date(`${editForm.date}T12:00:00`).toISOString(),
      });
      if (response.success) {
        toast.success('Expense updated successfully');
        setEditSheetOpen(false);
        const updated = response.data.expense;
        setExpenses((prev) => prev.map((e) => (e.id === selectedExpense.id ? updated : e)));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update expense'));
    }
  };

  const confirmDelete = async () => {
    if (!selectedExpense) return;
    try {
      const response = await api.deleteExpense(selectedExpense.id);
      if (response.success) {
        toast.success('Expense deleted successfully');
        setDeleteSheetOpen(false);
        setExpenses((prev) => prev.filter((e) => e.id !== selectedExpense.id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete expense'));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const buffer = await api.exportExpenses(exportFormat, exportFrom || undefined, exportTo || undefined);
      const result = await saveExportedFile({
        base64: base64FromArrayBuffer(buffer),
        baseName: `expenses-${new Date().toISOString().slice(0, 10)}`,
        extension: exportFormat,
        mimeType: exportFormat === 'csv' ? 'text/csv' : 'application/pdf',
      });

      if (result.status === 'unavailable') {
        toast.error('Sharing is not available on this device');
        return;
      }

      setExportSheetOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally {
      setIsExporting(false);
    }
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const res = await api.searchExpenses(q);
      if (res.success) {
        setSearchResults(Array.isArray(res.data?.expenses) ? res.data.expenses : []);
        setSearchTotalAmount(res.data?.totalAmount ?? 0);
        setSearchCurrency(res.data?.currency ?? user?.currency ?? 'USD');
      }
    } catch (error) {
      const unreachable = isUnreachableError(error) || (await isCurrentlyOffline());
      if (unreachable) {
        toast.info('Search needs a connection. Your saved list is still available.');
        return;
      }
      toast.error(getErrorMessage(error, 'Search failed'));
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const searchActive = searchResults !== null;

  const activeFiltersCount = [filters.category, filters.startDate, filters.endDate].filter(Boolean).length;

  const pendingExpenses: Expense[] = pending
    .filter((p) => {
      if (filters.category && p.category !== filters.category) return false;
      if (filters.startDate && p.date.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate && p.date.slice(0, 10) > filters.endDate) return false;
      return true;
    })
    .map((p) => ({
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
  const displayExpenses = useMemo(() => {
    const pendingIds = new Set(pendingExpenses.map((p) => p.id));
    return [...pendingExpenses, ...expenses.filter((e) => !pendingIds.has(e.id))];
  }, [expenses, pendingExpenses]);

  const expenseSections = useMemo(() => groupExpensesByDay(displayExpenses), [displayExpenses]);
  const chipCategories = useMemo(() => categories.filter(Boolean).slice(0, 8), [categories]);

  const selectCategoryChip = (category: string) => {
    setFilters((f) => ({ ...f, category }));
  };

  const listFooter =
    isLoadingMore && !searchActive ? (
      <View style={styles.loadMoreFooter}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    ) : null;

  const listContentPadding = { paddingBottom: spacing.s3, gap: spacing.s3 };

  const listHeader = (
    <View style={[styles.listHeader, { paddingTop: tabTopPadding }]}>
      {!isPremium ? (
        <Pressable onPress={() => router.push('/premium')}>
          <View style={[styles.freeBanner, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontSize: fontSize.xs }}>
              Viewing past 3 months.{' '}
              <Text style={{ fontFamily: fonts.bold, textDecorationLine: 'underline' }}>Upgrade to Premium</Text> for
              full history.
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Expenses</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              {total} transaction{total !== 1 ? 's' : ''}
            </Text>
            {showingCached ? (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                Last downloaded{cacheSavedAt ? ` · ${formatCacheAge(cacheSavedAt)}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => (isPremium ? setExportSheetOpen(true) : toast.error('Export is available on Premium'))}
              style={[styles.iconSquare, { borderColor: colors.border, backgroundColor: colors.bgCard, opacity: isPremium ? 1 : 0.5 }]}
              accessibilityLabel="Export"
            >
              <Ionicons name={isPremium ? 'download-outline' : 'lock-closed-outline'} size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              style={[styles.iconSquare, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
              accessibilityLabel="Filter"
            >
              <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
              {activeFiltersCount > 0 ? (
                <View style={[styles.filterBadge, { backgroundColor: colors.accentSoft }]}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontFamily: fonts.bold }}>{activeFiltersCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Natural-language search */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.bgCard, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            placeholder="Search descriptions, categories…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : searchActive || searchQuery ? (
            <Pressable onPress={clearSearch} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Search results summary */}
        {searchActive ? (
          <View style={[styles.freeBanner, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>
              {searchResults!.length} result{searchResults!.length !== 1 ? 's' : ''}
              {searchResults!.length > 0 ? ` · ${formatCurrency(searchTotalAmount, searchCurrency)} total` : ''} — tap ✕ to
              go back
            </Text>
          </View>
        ) : null}

        {!searchActive ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            <Pressable
              onPress={() => selectCategoryChip('')}
              style={[
                styles.chip,
                !filters.category
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.bgCard, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: !filters.category ? colors.onAccent : colors.textSecondary },
                ]}
              >
                All
              </Text>
            </Pressable>
            {chipCategories.map((cat) => {
              const active = filters.category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => selectCategoryChip(cat)}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : { backgroundColor: colors.bgCard, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.textSecondary }]} numberOfLines={1}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {searchActive ? (
        <FlatList
          style={styles.list}
          data={searchResults?.length ? [{ key: 'results' }] : []}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.pagePad, { paddingBottom: spacing.s3 }]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Nothing matched"
              message="No expenses match that text. Try another word from the description or category."
            />
          }
          renderItem={() => (
            <Card padded={false} style={styles.searchListCard}>
              {searchResults!.map((item, index) => (
                <ExpenseListRow
                  key={item.id}
                  item={item}
                  colors={colors}
                  showDivider={index < searchResults!.length - 1}
                  onPress={() => handleEdit(item as unknown as Expense)}
                />
              ))}
            </Card>
          )}
        />
      ) : isLoading && displayExpenses.length === 0 ? (
        <View style={[styles.pagePad, { flex: 1, paddingBottom: spacing.s3 }]}>
          {listHeader}
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        </View>
      ) : displayExpenses.length === 0 ? (
        <View style={[styles.pagePad, { flex: 1, paddingBottom: spacing.s3 }]}>
          {listHeader}
          <EmptyState
            icon={showingCached ? 'cloud-offline-outline' : 'receipt-outline'}
            title={showingCached ? 'Nothing saved on this device' : 'No expenses found'}
            message={
              showingCached
                ? 'Open this list while online once, and it will be here next time you are offline.'
                : 'Try adjusting your filters or add new expenses'
            }
          />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={expenseSections}
          keyExtractor={(section) => section.dayKey}
          contentContainerStyle={[styles.pagePad, listContentPadding, { paddingBottom: spacing.s3 }]}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item: section }) => (
            <ExpenseDayBlock section={section} colors={colors} onPressRow={handlePressRow} />
          )}
        />
      )}

      {/* Filters sheet */}
      <BottomSheet visible={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Filter expenses">
        <View style={{ gap: spacing.s3 }}>
          <SelectSheet
            label="Category"
            value={draftFilters.category}
            options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
            onChange={(v) => setDraftFilters((f) => ({ ...f, category: v }))}
          />
          <DateField
            label="From"
            value={draftFilters.startDate}
            onChange={(v) => setDraftFilters((f) => ({ ...f, startDate: v }))}
            minimumDate={!isPremium ? new Date(`${minDateFree}T00:00:00`) : undefined}
            maximumDate={new Date()}
            clearable
          />
          {!isPremium ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: -spacing.s2 }}>
              Free: last 3 months only
            </Text>
          ) : null}
          <DateField
            label="To"
            value={draftFilters.endDate}
            onChange={(v) => setDraftFilters((f) => ({ ...f, endDate: v }))}
            maximumDate={new Date()}
            clearable
          />
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button
              title="Clear"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                setFilters({ category: '', startDate: '', endDate: '' });
                setFilterSheetOpen(false);
              }}
            />
            <Button
              title="Apply"
              style={{ flex: 1 }}
              onPress={() => {
                setFilters(draftFilters);
                setFilterSheetOpen(false);
              }}
            />
          </View>
        </View>
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet visible={editSheetOpen} onClose={() => setEditSheetOpen(false)} title="Edit Expense">
        <View style={{ gap: spacing.s3 }}>
          <Input
            label="Description"
            value={editForm.description}
            onChangeText={(v) => setEditForm((f) => ({ ...f, description: v }))}
          />
          <Input
            label="Amount"
            value={editForm.amount}
            onChangeText={(v) => setEditForm((f) => ({ ...f, amount: v }))}
            keyboardType="decimal-pad"
          />
          <CategoryInput
            label="Category"
            value={editForm.category}
            onChange={(v) => setEditForm((f) => ({ ...f, category: v }))}
            suggestions={categories}
            placeholder="Type or select category"
          />
          <DateField label="Date" value={editForm.date} onChange={(v) => setEditForm((f) => ({ ...f, date: v }))} />
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setEditSheetOpen(false)} />
            <Button title="Save Changes" style={{ flex: 1 }} onPress={handleSaveEdit} />
          </View>
          <Button
            title="Delete expense"
            variant="ghost"
            onPress={() => {
              setEditSheetOpen(false);
              setDeleteSheetOpen(true);
            }}
          />
        </View>
      </BottomSheet>

      {/* Delete confirmation sheet */}
      <BottomSheet visible={deleteSheetOpen} onClose={() => setDeleteSheetOpen(false)} title="Delete Expense">
        <View style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textPrimary }}>
            Are you sure you want to delete this expense? This action cannot be undone.
          </Text>
          {selectedExpense ? (
            <View style={[styles.deletePreview, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium }}>{selectedExpense.description}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
                {formatCurrency(selectedExpense.amount, selectedExpense.currency)} • {selectedExpense.category}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDeleteSheetOpen(false)} />
            <Button title="Delete" variant="danger" style={{ flex: 1 }} onPress={confirmDelete} />
          </View>
        </View>
      </BottomSheet>

      {/* Export sheet */}
      <BottomSheet visible={exportSheetOpen} onClose={() => setExportSheetOpen(false)} title="Export Expenses">
        <View style={{ gap: spacing.s3 }}>
          <SegmentedControl
            segments={[
              { value: 'csv', label: 'CSV' },
              { value: 'pdf', label: 'PDF' },
            ]}
            value={exportFormat}
            onChange={(v) => setExportFormat(v as 'csv' | 'pdf')}
          />
          <DateField label="From (optional)" value={exportFrom} onChange={setExportFrom} clearable />
          <DateField label="To (optional)" value={exportTo} onChange={setExportTo} clearable />
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
            Leave dates empty to export all expenses. You will pick where to save the file (Downloads, Drive, etc.).
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setExportSheetOpen(false)} />
            <Button title={isExporting ? 'Exporting…' : 'Export'} style={{ flex: 1 }} onPress={handleExport} loading={isExporting} />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pagePad: {
    paddingHorizontal: spacing.s4,
  },
  listHeader: {
    gap: spacing.s3,
    paddingBottom: spacing.s3,
  },
  searchListCard: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 20,
  },
  list: {
    flex: 1,
  },
  dayBlock: {
    gap: spacing.s2,
  },
  dayCard: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  dayTotalCol: {
    alignItems: 'flex-end',
    gap: 1,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.s2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.s2,
    flexShrink: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.s3,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.s2,
    fontSize: fontSize.sm,
  },
  freeBanner: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    gap: 8,
    paddingRight: spacing.s2,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 160,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.s2,
    paddingBottom: spacing.s2,
  },
  dayLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
  },
  dayTotal: {
    fontSize: fontSize.md,
    fontFamily: fonts.bold,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s4,
    paddingVertical: 13,
    minHeight: 44,
  },
  txMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  txTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
    minWidth: 72,
  },
  txAmount: {
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  txCategory: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  txCurrency: {
    fontSize: 11,
    fontFamily: fonts.medium,
    textAlign: 'right',
  },
  loadMoreFooter: {
    paddingVertical: spacing.s4,
    alignItems: 'center',
  },
  deletePreview: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.s3,
    gap: 4,
  },
});
