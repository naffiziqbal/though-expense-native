import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeTop } from '../../hooks/useSafeTop';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { CategoryInput } from '../../components/ui/CategoryInput';
import { DateField } from '../../components/ui/DateField';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectSheet } from '../../components/ui/SelectSheet';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import type { Expense, SearchResultExpense } from '../../lib/types';
import { cleanExpenseDescription, formatCurrency, formatDate } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { usePendingStore } from '../../store/pendingStore';

const PAGE_SIZE = 10;

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
  const topInset = useSafeTop();
  const { user } = useAuthStore();
  const pending = usePendingStore((s) => s.items);
  const isPremium = user?.isPremium ?? false;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);

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
  const firstLoad = useRef(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchExpenses = useCallback(
    async (targetPage: number, activeFilters: typeof filters) => {
      setIsLoading(true);
      try {
        const offset = (targetPage - 1) * PAGE_SIZE;
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
        if (response.success) {
          setExpenses(response.data.expenses);
          setTotal(response.data.pagination.total);
        }
      } catch {
        toast.error('Failed to fetch expenses');
      } finally {
        setIsLoading(false);
      }
    },
    [isPremium, minDateFree]
  );

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.getCategorySummary();
      if (res.success && res.data.byCategory) setCategories(Object.keys(res.data.byCategory));
    } catch {
      // no categories yet
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchExpenses(page, filters);
      if (firstLoad.current) {
        fetchCategories();
        firstLoad.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters])
  );

  useEffect(() => {
    if (filterSheetOpen) setDraftFilters(filters);
  }, [filterSheetOpen, filters]);

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date.split('T')[0],
    });
    setEditSheetOpen(true);
  };

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
        fetchExpenses(page, filters);
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
        fetchExpenses(page, filters);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete expense'));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const buffer = await api.exportExpenses(exportFormat, exportFrom || undefined, exportTo || undefined);
      const filename = `expenses-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, base64FromArrayBuffer(buffer), {
        encoding: FileSystem.EncodingType.Base64,
      });
      setExportSheetOpen(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: exportFormat === 'csv' ? 'text/csv' : 'application/pdf',
          dialogTitle: 'Export expenses',
        });
      } else {
        toast.success(`Saved to ${fileUri}`);
      }
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
        setSearchResults(res.data.expenses);
        setSearchTotalAmount(res.data.totalAmount);
        setSearchCurrency(res.data.currency);
      }
    } catch (error) {
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
  const displayExpenses = page === 1 ? [...pendingExpenses, ...expenses] : expenses;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary, paddingTop: topInset + spacing.s3 }}>
      <View style={styles.container}>
        {/* Free-tier banner */}
        {!isPremium ? (
          <Pressable onPress={() => router.push('/premium')}>
            <View style={[styles.freeBanner, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.accent, fontSize: fontSize.xs }}>
                Viewing past 3 months. <Text style={{ fontFamily: fonts.bold, textDecorationLine: 'underline' }}>Upgrade to Premium</Text> for full history.
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>All Expenses</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              {total} transaction{total !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Pressable
              onPress={() => (isPremium ? setExportSheetOpen(true) : toast.error('Export is available on Premium'))}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bgCard, opacity: isPremium ? 1 : 0.5 }]}
            >
              <Ionicons name={isPremium ? 'download-outline' : 'lock-closed-outline'} size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>Export</Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
            >
              <Ionicons name="filter" size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>Filter</Text>
              {activeFiltersCount > 0 ? (
                <View style={[styles.filterBadge, { backgroundColor: colors.accentSoft }]}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontFamily: fonts.bold }}>{activeFiltersCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Natural-language search */}
        <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            placeholder='Search anything — "coffee last month", "over 500"'
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

        {/* List */}
        {searchActive ? (
          searchResults!.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Nothing matched"
              message="Try different words — I search meanings, not just exact text."
            />
          ) : (
            <Card padded={false} style={{ flex: 1 }}>
              <FlatList
                data={searchResults!}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => handleEdit(item as unknown as Expense)}
                    style={[
                      styles.txRow,
                      index < searchResults!.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <CategoryIconBubble category={item.category} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }} numberOfLines={1}>
                        {cleanExpenseDescription(item.description)}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
                        {formatDate(item.date)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>
                        -{formatCurrency(item.amount, item.currency)}
                      </Text>
                      <CategoryBadge category={item.category} />
                    </View>
                  </Pressable>
                )}
              />
            </Card>
          )
        ) : isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : displayExpenses.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No expenses found"
            message="Try adjusting your filters or add new expenses"
          />
        ) : (
          <Card padded={false} style={{ flex: 1 }}>
            <FlatList
              data={displayExpenses}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => {
                    if (item.id.startsWith('pending:')) return;
                    handleEdit(item);
                  }}
                  style={[
                    styles.txRow,
                    index < displayExpenses.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <CategoryIconBubble category={item.category} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }} numberOfLines={1}>
                      {cleanExpenseDescription(item.description)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
                      {formatDate(item.date)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>
                      -{formatCurrency(item.amount, item.currency)}
                    </Text>
                    <CategoryBadge category={item.category} />
                  </View>
                </Pressable>
              )}
            />
          </Card>
        )}

        {/* Pagination */}
        {!searchActive && !isLoading && total > 0 ? (
          <View style={styles.pagination}>
            <Pressable
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={[styles.pageBtn, { borderColor: colors.border, backgroundColor: colors.bgCard, opacity: page <= 1 ? 0.4 : 1 }]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              Page {page} of {totalPages}
            </Text>
            <Pressable
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={[styles.pageBtn, { borderColor: colors.border, backgroundColor: colors.bgCard, opacity: page >= totalPages ? 0.4 : 1 }]}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        ) : null}
      </View>

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
                setPage(1);
                setFilterSheetOpen(false);
              }}
            />
            <Button
              title="Apply"
              style={{ flex: 1 }}
              onPress={() => {
                setFilters(draftFilters);
                setPage(1);
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
            Leave dates empty to export all expenses.
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
  container: {
    flex: 1,
    paddingHorizontal: spacing.s4,
    gap: spacing.s3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
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
    alignItems: 'flex-end',
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  filterBadge: {
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
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s3,
    paddingBottom: spacing.s2,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.s2,
  },
  deletePreview: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.s3,
    gap: 4,
  },
});
