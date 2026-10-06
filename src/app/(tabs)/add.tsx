import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSpacer } from '../../components/ui/KeyboardSpacer';
import { useClipboardCapture } from '../../hooks/useClipboardCapture';
import { isCurrentlyOffline } from '../../hooks/useOutboxSync';
import { useTabScreenTopPadding } from '../../hooks/useSafeTop';
import { useTourTarget } from '../../hooks/useTourTarget';
import { TOUR_TARGETS } from '../../lib/tourSteps';
import { CategoryIconBubble } from '../../components/CategoryIconBubble';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateField } from '../../components/ui/DateField';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { IMPORT_IMAGE_PICKER_OPTIONS } from '../../lib/imagePickerOptions';
import { formatCurrency, getCategoryFromKeyword, parseExpenseInputLocally } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useOutboxStore } from '../../store/outboxStore';
import { usePendingStore } from '../../store/pendingStore';

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
  const tabTopPadding = useTabScreenTopPadding();
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
  const inputTarget = useTourTarget(TOUR_TARGETS.addInput);
  const saveTarget = useTourTarget(TOUR_TARGETS.addSave);

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

  const { suggestion: clipboardSuggestion, dismiss: dismissClipboard } =
    useClipboardCapture(rawInput);

  const applyClipboard = () => {
    if (!clipboardSuggestion) return;
    const next = rawInput.trim() ? `${rawInput.trim()}, ${clipboardSuggestion}` : clipboardSuggestion;
    setRawInput(next);
    updatePreview(next);
    dismissClipboard();
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
        result = await ImagePicker.launchCameraAsync(IMPORT_IMAGE_PICKER_OPTIONS);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(IMPORT_IMAGE_PICKER_OPTIONS);
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
    const parsed = parseExpenseInputLocally(toSubmit);
    if (!parsed.length) {
      toast.error('Could not read amounts from that text');
      return;
    }

    setIsSaving(true);
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const localPreview = parsed.map((p) => ({
      description: p.description,
      amount: p.amount,
      currency,
      category: getCategoryFromKeyword(p.description),
      date: selectedDate,
      rawInput: p.rawInput,
    }));

    const queueOffline = (reason: 'offline' | 'network-error') => {
      useOutboxStore.getState().enqueue({
        id: batchId,
        rawInput: toSubmit,
        date: selectedDate,
        items: localPreview.map((p) => ({
          description: p.description,
          amount: p.amount,
          currency,
          category: p.category || 'Other',
          date: selectedDate,
          rawInput: p.rawInput || toSubmit,
        })),
      });
      setRawInput('');
      setReceiptItems([]);
      toast.success(
        reason === 'offline' ? 'Saved offline — will sync when you reconnect' : 'Saved — will sync shortly'
      );
      router.push('/(tabs)');
    };

    if (await isCurrentlyOffline()) {
      queueOffline('offline');
      setIsSaving(false);
      return;
    }

    try {
      const res = await api.enqueueParseExpenses(
        { rawInput: toSubmit, create: true, date: selectedDate, localPreview, clientBatchId: batchId },
        batchId
      );
      const jobId = res.data.jobId;
      usePendingStore.getState().enqueue(
        localPreview.map((p, i) => ({
          localId: `${batchId}-${i}`,
          jobId,
          batchId,
          description: p.description,
          amount: p.amount,
          currency,
          category: p.category || 'Other',
          date: selectedDate,
          rawInput: p.rawInput || toSubmit,
          createdAt: new Date().toISOString(),
        }))
      );
      setRawInput('');
      setReceiptItems([]);
      toast.success('Saved');
      router.push('/(tabs)');
    } catch (error) {
      // The request never reached the server, so the same idempotency key is
      // safe to replay from the outbox.
      const axiosError = error as { response?: unknown; code?: string };
      if (!axiosError.response || axiosError.code === 'ECONNABORTED') {
        queueOffline('network-error');
      } else {
        toast.error(getErrorMessage(error, 'Failed to queue expenses'));
      }
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
        <View style={[styles.container, { paddingTop: tabTopPadding }]}>
          {/* Header */}
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Quick Log</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
              Type details in plain language — AI does the rest
            </Text>
          </View>

          {/* Smart input card */}
          <Card {...inputTarget} padded={false}>
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

          {/* One-tap capture from the clipboard */}
          {clipboardSuggestion ? (
            <Pressable
              onPress={applyClipboard}
              style={[
                styles.clipboardChip,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
            >
              <Ionicons name="clipboard-outline" size={16} color={colors.accent} />
              <Text
                style={{ color: colors.textPrimary, fontSize: fontSize.sm, flex: 1 }}
                numberOfLines={1}
              >
                Add “{clipboardSuggestion}” from clipboard
              </Text>
              <Pressable onPress={dismissClipboard} hitSlop={10}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ) : null}

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
          <View {...saveTarget} style={{ paddingBottom: spacing.s3 }}>
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
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
});
