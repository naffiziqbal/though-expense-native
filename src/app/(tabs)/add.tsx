import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateField } from '../../components/ui/DateField';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { formatCurrency, getCategoryFromKeyword, parseExpenseInputLocally } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

interface ReceiptItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  rawInput?: string;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SaveStage = 'text' | 'amounts' | 'categorizing' | 'saving' | null;

export default function AddExpenseScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  const [rawInput, setRawInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStage, setSaveStage] = useState<SaveStage>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [itemsToSave, setItemsToSave] = useState<ReceiptItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePreview = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = parseExpenseInputLocally(text);
      setReceiptItems(
        parsed.map((p, i) => ({
          id: `preview-${i}-${p.rawInput}`,
          description: p.description,
          amount: p.amount,
          category: getCategoryFromKeyword(p.description),
          rawInput: p.rawInput,
        }))
      );
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = (value: string) => {
    setRawInput(value);
    updatePreview(value);
  };

  const handleEditItem = (id: string, description: string) => {
    setReceiptItems((prev) => prev.map((item) => (item.id === id ? { ...item, description } : item)));
  };

  const handleDeleteItem = (id: string) => {
    const remaining = receiptItems.filter((i) => i.id !== id);
    setReceiptItems(remaining);
    const newRawInput = remaining.map((i) => i.rawInput ?? `${i.description} ${i.amount}`).join(', ');
    setRawInput(newRawInput);
  };

  const handleSave = async () => {
    const hasInput = rawInput.trim().length > 0;
    const hasItems = receiptItems.length > 0;
    if (!hasInput && !hasItems) {
      toast.error('Add some items first');
      return;
    }
    const toSubmit = hasInput ? rawInput : receiptItems.map((i) => `${i.description} ${i.amount}`).join('\n');

    setIsSaving(true);
    setSaveStage('text');
    const t1 = setTimeout(() => setSaveStage('amounts'), 400);
    const t2 = setTimeout(() => setSaveStage('categorizing'), 900);

    try {
      const parseRes = await api.parseExpenses({ rawInput: toSubmit, create: false });
      clearTimeout(t1);
      clearTimeout(t2);

      if (!parseRes.success || !parseRes.data?.expenses?.length) {
        setSaveStage(null);
        toast.error('Could not parse expenses');
        return;
      }

      const parsed = parseRes.data.expenses;
      setItemsToSave(
        parsed.map((e, i) => ({
          id: `save-${i}-${e.description}-${e.amount}`,
          description: e.description,
          amount: e.amount,
          category: e.category,
        }))
      );
      setSaveStage('saving');

      for (const exp of parsed) {
        await api.createExpense({
          description: exp.description,
          amount: exp.amount,
          currency: exp.currency || currency,
          category: exp.category,
          date: exp.date || selectedDate,
          rawInput: exp.rawInput,
        });
        setItemsToSave((prev) => prev.slice(1));
      }

      setSaveStage(null);
      setItemsToSave([]);
      setRawInput('');
      setReceiptItems([]);
      toast.success('Saved!');
      router.push('/(tabs)');
    } catch (error) {
      clearTimeout(t1);
      clearTimeout(t2);
      setSaveStage(null);
      setItemsToSave([]);
      toast.error(getErrorMessage(error, 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  const hasContent = rawInput.trim().length > 0 || receiptItems.length > 0;
  const displayItems = itemsToSave.length > 0 ? itemsToSave : receiptItems;

  const stageLabel =
    saveStage === 'text'
      ? '✓ Text received'
      : saveStage === 'amounts'
        ? '🔍 Identifying amounts'
        : saveStage === 'categorizing'
          ? '🧠 Categorizing expenses'
          : saveStage === 'saving'
            ? `💾 Saving (${itemsToSave.length} left)`
            : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { paddingTop: insets.top + spacing.s3 }]}>
          {/* Header */}
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Quick Log</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
              Type details in plain language — AI does the rest
            </Text>
          </View>

          {/* Smart input card */}
          <Card padded={false}>
            <TextInput
              value={rawInput}
              onChangeText={handleInputChange}
              placeholder="Lunch 500"
              placeholderTextColor={colors.textMuted}
              editable={!isSaving}
              multiline
              style={[styles.textarea, { color: colors.textPrimary }]}
            />
            <View style={[styles.mediaBar, { borderTopColor: colors.border }]}>
              {receiptItems.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Ionicons name="sparkles" size={14} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                    {receiptItems.length} item{receiptItems.length !== 1 ? 's' : ''} detected
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, flex: 1 }}>
                  e.g. “coffee 120, uber 250 and groceries 900”
                </Text>
              )}
              <View style={{ width: 150 }}>
                <DateField value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()} />
              </View>
            </View>
          </Card>

          {/* Live receipt list */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.s2, paddingBottom: spacing.s4 }} keyboardShouldPersistTaps="handled">
            {displayItems.map((item) => {
              const canDelete = itemsToSave.length === 0;
              return (
                <Card key={item.id} style={styles.itemRow}>
                  <CategoryIconBubble category={item.category} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {editingId === item.id ? (
                      <TextInput
                        value={item.description}
                        onChangeText={(v) => handleEditItem(item.id, v)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                        style={{
                          color: colors.textPrimary,
                          fontSize: fontSize.md,
                          fontFamily: fonts.medium,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.accent,
                          paddingVertical: 2,
                        }}
                      />
                    ) : (
                      <Pressable onPress={() => canDelete && setEditingId(item.id)}>
                        <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.md }} numberOfLines={1}>
                          {item.description}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>
                    -{formatCurrency(item.amount, currency)}
                  </Text>
                  {canDelete ? (
                    <Pressable onPress={() => handleDeleteItem(item.id)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </Card>
              );
            })}
          </ScrollView>

          {/* Save button */}
          <View style={{ paddingBottom: spacing.s3 }}>
            <Button
              title={stageLabel || 'Save All Items'}
              onPress={handleSave}
              disabled={!hasContent}
              loading={isSaving && !stageLabel}
              size="lg"
            />
            {isSaving && stageLabel ? (
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.s2 }}>
                {stageLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.s4,
    gap: spacing.s4,
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  textarea: {
    minHeight: 120,
    padding: spacing.s4,
    fontSize: 20,
    textAlignVertical: 'top',
  },
  mediaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    padding: spacing.s3,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    padding: spacing.s3,
  },
});
