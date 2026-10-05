import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabScreenTopPadding } from '../../hooks/useSafeTop';
import axios from 'axios';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { ADVISOR_PROMPT_GROUPS, type AdvisorPrompt } from '../../lib/advisorPrompts';
import { api, getErrorMessage } from '../../lib/api';
import type { ChatTurn, SavingsPlan } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

interface Message extends ChatTurn {
  id: string;
  followUps?: string[];
  plan?: SavingsPlan;
}

let nextId = 0;
const msgId = () => `msg-${++nextId}`;

function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

function SavingsPlanBlock({ plan, colors }: { plan: SavingsPlan; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ gap: spacing.s2, marginTop: spacing.s2 }}>
      {plan.steps.map((step, i) => (
        <View key={`${step.category}-${i}`} style={[styles.planStep, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>{step.category}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>{step.action}</Text>
          </View>
          <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: fontSize.sm }}>
            +{formatCurrency(step.estimatedMonthlySaving, plan.currency)}
          </Text>
        </View>
      ))}
      <View style={[styles.planTotal, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>Estimated total</Text>
        <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>
          {formatCurrency(plan.estimatedTotalSaving, plan.currency)}/mo
        </Text>
      </View>
    </View>
  );
}

export default function AssistantScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabTopPadding = useTabScreenTopPadding(spacing.s2);
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planAmount, setPlanAmount] = useState('');
  const [quickSaveAmount, setQuickSaveAmount] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const runSavingsPlan = useCallback(
    async (target: number, label?: string) => {
      if (thinking) return;
      const userMsg: Message = {
        id: msgId(),
        role: 'user',
        content: label || `Build a savings plan for ${formatCurrency(target, user?.currency || 'USD')}`,
      };
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);
      scrollToEnd();
      try {
        const res = await api.getSavingsPlan(target);
        if (res.success) {
          setRemaining(res.data.remainingFreeQuestions ?? null);
          setMessages((prev) => [
            ...prev,
            {
              id: msgId(),
              role: 'assistant',
              content: res.data.plan.summary || 'Here is your savings plan:',
              plan: res.data.plan,
            },
          ]);
        }
      } catch (error) {
        handleError(error);
      } finally {
        setThinking(false);
        scrollToEnd();
      }
    },
    [thinking, scrollToEnd, user?.currency]
  );

  const runWhy = useCallback(
    async (question: string) => {
      if (thinking) return;
      setMessages((prev) => [...prev, { id: msgId(), role: 'user', content: question }]);
      setThinking(true);
      scrollToEnd();
      try {
        const res = await api.askWhySpendingChanged();
        if (res.success) {
          setRemaining(res.data.remainingFreeQuestions);
          setMessages((prev) => [
            ...prev,
            { id: msgId(), role: 'assistant', content: res.data.answer, followUps: res.data.followUps },
          ]);
        }
      } catch (error) {
        handleError(error);
      } finally {
        setThinking(false);
        scrollToEnd();
      }
    },
    [thinking, scrollToEnd]
  );

  const handleError = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      setQuotaExhausted(true);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: msgId(),
        role: 'assistant',
        content: getErrorMessage(error, 'I could not answer that right now. Please try again.'),
      },
    ]);
  };

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || thinking) return;

      const bare = parseAmount(trimmed);
      if (bare !== null) {
        await runSavingsPlan(bare, trimmed);
        return;
      }

      const userMsg: Message = { id: msgId(), role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setThinking(true);
      scrollToEnd();

      try {
        const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
        const res = await api.askAssistant(trimmed, history);
        if (res.success) {
          setRemaining(res.data.remainingFreeQuestions);
          setMessages((prev) => [
            ...prev,
            { id: msgId(), role: 'assistant', content: res.data.answer, followUps: res.data.followUps },
          ]);
        }
      } catch (error) {
        handleError(error);
      } finally {
        setThinking(false);
        scrollToEnd();
      }
    },
    [messages, thinking, scrollToEnd, runSavingsPlan]
  );

  const handlePrompt = (prompt: AdvisorPrompt) => {
    if (prompt.action === 'plan') setPlanSheetOpen(true);
    else if (prompt.action === 'why') runWhy(prompt.question);
    else send(prompt.question);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const followUps = !thinking && lastAssistant?.followUps?.length ? lastAssistant.followUps : [];

  const renderEmpty = () => (
    <View style={{ gap: spacing.s4, paddingBottom: spacing.s4 }}>
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 }}>
        Ask why spending changed, where money goes, or get a savings plan from your real transactions — not generic tips.
      </Text>

      <View style={[styles.quickPlan, { borderColor: `${colors.accent}55`, backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>Quick savings plan</Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
          Target for next month ({user?.currency || 'USD'})
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s2, marginTop: spacing.s2 }}>
          <TextInput
            value={quickSaveAmount}
            onChangeText={setQuickSaveAmount}
            placeholder="e.g. 5000"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
            style={[styles.quickInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
          />
          <Button title="Build" size="sm" onPress={() => {
            const v = parseAmount(quickSaveAmount);
            if (!v) {
              toast.error('Enter an amount');
              return;
            }
            setQuickSaveAmount('');
            runSavingsPlan(v);
          }} />
        </View>
      </View>

      {ADVISOR_PROMPT_GROUPS.map((group) => (
        <View key={group.id}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.label}</Text>
          <View style={[styles.groupCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            {group.prompts.map((prompt, i) => (
              <Pressable
                key={prompt.id}
                onPress={() => handlePrompt(prompt)}
                disabled={thinking}
                style={[
                  styles.promptRow,
                  i < group.prompts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>{prompt.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{prompt.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.onAccent, fontSize: fontSize.sm }}>{item.content}</Text>
        </View>
      );
    }
    return (
      <View style={{ alignSelf: 'stretch', maxWidth: '96%' }}>
        <Text style={{ color: colors.accent, fontSize: 11, fontFamily: fonts.medium, marginBottom: 4 }}>Penny</Text>
        <View style={[styles.assistantBubble, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, lineHeight: 21 }}>{item.content}</Text>
          {item.plan ? <SavingsPlanBlock plan={item.plan} colors={colors} /> : null}
        </View>
      </View>
    );
  };

  return (
    <Screen scroll={false} contentStyle={{ padding: 0, gap: 0, paddingTop: 0 }}>
      <View style={{ flex: 1, paddingTop: tabTopPadding }}>
        <View
          style={[
            styles.topBar,
            {
              paddingHorizontal: spacing.s3,
              paddingVertical: spacing.s2,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
              backgroundColor: colors.bgCard,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="sparkles" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>Penny</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>Your spending data</Text>
          </View>
          {!isPremium && remaining !== null ? (
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>{remaining} free</Text>
          ) : null}
          {messages.length > 0 ? (
            <Pressable onPress={() => setMessages([])} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>New chat</Text>
            </Pressable>
          ) : null}
        </View>

        <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: spacing.s4, gap: spacing.s3, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          thinking ? (
            <View style={{ maxWidth: '96%' }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>Penny</Text>
              <View style={[styles.assistantBubble, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Checking your spending…</Text>
              </View>
            </View>
          ) : null
        }
        style={{ flex: 1 }}
      />

      {followUps.length > 0 ? (
        <View style={[styles.followUps, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: fonts.medium, marginBottom: spacing.s1 }}>
            FOLLOW UP
          </Text>
          <View style={styles.chipsRow}>
            {followUps.map((f) => (
              <Pressable key={f} onPress={() => send(f)} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {quotaExhausted && !isPremium ? (
        <View style={[styles.quotaBanner, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.accent, fontSize: fontSize.sm, flex: 1 }}>Free questions used this month.</Text>
          <Button title="Upgrade" size="sm" onPress={() => router.push('/premium')} />
        </View>
      ) : null}

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.bgCard,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, spacing.s3),
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your spending…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg }]}
          multiline
          editable={!thinking}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={thinking || !input.trim()}
          style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: thinking || !input.trim() ? 0.5 : 1 }]}
        >
          <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
        </Pressable>
      </View>

      <BottomSheet visible={planSheetOpen} onClose={() => setPlanSheetOpen(false)} title="Savings plan">
        <View style={{ gap: spacing.s3 }}>
          <Input
            label={`Target for next month (${user?.currency || 'USD'})`}
            value={planAmount}
            onChangeText={setPlanAmount}
            keyboardType="decimal-pad"
            placeholder="Amount to save"
          />
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setPlanSheetOpen(false)} />
            <Button
              title="Build plan"
              style={{ flex: 1 }}
              onPress={() => {
                const v = parseAmount(planAmount);
                if (!v) {
                  toast.error('Enter a valid amount');
                  return;
                }
                setPlanSheetOpen(false);
                setPlanAmount('');
                runSavingsPlan(v);
              }}
            />
          </View>
        </View>
      </BottomSheet>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  backBtn: {
    marginRight: -spacing.s1,
  },
  heroIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.s2,
    marginLeft: spacing.s1,
  },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  quickPlan: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s3,
  },
  quickInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    fontSize: fontSize.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  assistantBubble: {
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
  },
  followUps: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
  },
  planStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.s2,
  },
  planTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.s2,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    marginHorizontal: spacing.s4,
    marginBottom: spacing.s2,
    borderRadius: radius.md,
    padding: spacing.s3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.s2,
    padding: spacing.s3,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    fontSize: fontSize.md,
    maxHeight: 110,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
