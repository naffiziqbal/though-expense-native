import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSpacer } from '../../components/ui/KeyboardSpacer';
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
  const isPremium = user?.isPremium ?? false;

  const [rawInput, setRawInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
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

  const pickReceipt = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.error('Camera permission is required to scan receipts');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      }
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      setIsScanning(true);
      const res = await api.ocrReceipt(asset.uri, asset.mimeType || 'image/jpeg', asset.fileName || 'receipt.jpg');
      const text = res?.data?.text?.trim();
      if (res.success && text) {
        const newInput = rawInput ? `${rawInput}\n${text}` : text;
        setRawInput(newInput);
        updatePreview(newInput);
        toast.success('Text extracted!');
      } else {
        toast.error('No expenses found in the image');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to read receipt'));
    } finally {
      setIsScanning(false);
    }
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

      // One request for the whole batch — per-item POSTs were tripping rate limits
      await api.createExpensesBatch(
        parsed.map((exp) => ({
          description: exp.description,
          amount: exp.amount,
          currency: exp.currency || currency,
          category: exp.category,
          date: exp.date || selectedDate,
          rawInput: exp.rawInput,
        }))
      );

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
      <View style={{ flex: 1 }}>
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
              editable={!isSaving && !isScanning}
              multiline
              style={[styles.textarea, { color: colors.textPrimary }]}
            />
            <View style={[styles.mediaBar, { borderTopColor: colors.border }]}>
              {isPremium ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2, flex: 1 }}>
                  <Pressable
                    onPress={() => pickReceipt('camera')}
                    disabled={isScanning || isSaving}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: colors.textPrimary,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.s3,
                      minHeight: 40,
                      opacity: isScanning ? 0.6 : 1,
                    }}
                  >
                    {isScanning ? (
                      <ActivityIndicator size="small" color={colors.bgCard} />
                    ) : (
                      <Ionicons name="camera" size={16} color={colors.bgCard} />
                    )}
                    <Text style={{ color: colors.bgCard, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                      {isScanning ? 'Reading…' : 'Scan'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => pickReceipt('gallery')}
                    disabled={isScanning || isSaving}
                    hitSlop={6}
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push('/premium')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: colors.accent,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.s3,
                    minHeight: 40,
                    marginRight: spacing.s2,
                  }}
                >
                  <Ionicons name="camera" size={16} color={colors.onAccent} />
                  <Text style={{ color: colors.onAccent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                    Upgrade to scan
                  </Text>
                </Pressable>
              )}
              <View style={{ width: 140 }}>
                <DateField value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()} />
              </View>
            </View>
          </Card>

          {/* Detected items indicator */}
          {receiptItems.length > 0 && itemsToSave.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontFamily: fonts.semibold }}>
                {receiptItems.length} item{receiptItems.length !== 1 ? 's' : ''} detected
              </Text>
            </View>
          ) : null}

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
        <KeyboardSpacer />
      </View>
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
