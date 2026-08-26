import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import axios from 'axios';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { fonts, fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../lib/api';
import type { ChatTurn, SavingsPlan } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

interface Message extends ChatTurn {
  id: string;
  followUps?: string[];
  plan?: SavingsPlan;
}

const STARTERS = [
  'Why did I spend so much this month?',
  'How can I save 20000 next month?',
  'What are my biggest recurring expenses?',
  'Where am I wasting money?',
];

let nextId = 0;
const msgId = () => `msg-${++nextId}`;

/** "how can I save 20000 next month" -> 20000 (savings-plan intent) */
function extractSavingsTarget(question: string): number | null {
  const m = question.match(/sav(?:e|ing|ings)[^\d]{0,20}([\d][\d,]*(?:\.\d+)?)/i);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ''));
  return isFinite(amount) && amount > 0 ? amount : null;
}

export default function AssistantScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || thinking) return;

      const userMsg: Message = { id: msgId(), role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setThinking(true);
      scrollToEnd();

      try {
        const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
        const savingsTarget = extractSavingsTarget(trimmed);

        if (savingsTarget) {
          const res = await api.getSavingsPlan(savingsTarget);
          if (res.success) {
            setRemaining(res.data.remainingFreeQuestions);
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
        } else {
          const isWhy = /why did i spend so much/i.test(trimmed);
          const res = isWhy ? await api.askWhySpendingChanged() : await api.askAssistant(trimmed, history);
          if (res.success) {
            setRemaining(res.data.remainingFreeQuestions);
            setMessages((prev) => [
              ...prev,
              { id: msgId(), role: 'assistant', content: res.data.answer, followUps: res.data.followUps },
            ]);
          }
        }
      } catch (error) {
        const isQuota = axios.isAxiosError(error) && error.response?.status === 403;
        if (isQuota) setQuotaExhausted(true);
        setMessages((prev) => [
          ...prev,
          {
            id: msgId(),
            role: 'assistant',
            content: getErrorMessage(error, 'I could not answer that right now. Please try again.'),
          },
        ]);
      } finally {
        setThinking(false);
        scrollToEnd();
      }
    },
    [messages, thinking, scrollToEnd]
  );

  const renderPlan = (plan: SavingsPlan) => (
    <View style={{ gap: spacing.s2, marginTop: spacing.s2 }}>
      {plan.steps.map((step, i) => (
        <View
          key={`${step.category}-${i}`}
          style={[styles.planStep, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
              {step.category}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{step.action}</Text>
          </View>
          <Text style={{ color: colors.success, fontFamily: fonts.bold, fontSize: fontSize.sm }}>
            {formatCurrency(step.estimatedMonthlySaving, plan.currency)}
          </Text>
        </View>
      ))}
      <View style={[styles.planTotal, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
          {plan.feasible ? 'Estimated total savings' : 'Realistically reachable'}
        </Text>
        <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>
          {formatCurrency(plan.estimatedTotalSaving, plan.currency)}/mo
        </Text>
      </View>
      {!plan.feasible ? (
        <Text style={{ color: colors.warning, fontSize: fontSize.xs }}>
          Your target of {formatCurrency(plan.targetAmount, plan.currency)} isn't fully reachable from current
          spending — this is the honest maximum.
        </Text>
      ) : null}
    </View>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.onAccent, fontSize: fontSize.sm, fontFamily: fonts.medium }}>
            {item.content}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ gap: spacing.s2, alignSelf: 'stretch' }}>
        <View style={[styles.assistantBubble, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, lineHeight: 21 }}>{item.content}</Text>
          {item.plan ? renderPlan(item.plan) : null}
        </View>
        {item.followUps && item.followUps.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.followUps.map((f) => (
              <Pressable
                key={f}
                onPress={() => send(f)}
                style={[styles.chip, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
              >
                <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontFamily: fonts.medium }}>{f}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen scroll={false} contentStyle={{ padding: 0, gap: 0 }}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: spacing.s4, gap: spacing.s3, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.s3 }}>
            <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="sparkles" size={28} color={colors.accent} />
            </View>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold, fontSize: fontSize.lg }}>
              Ask your money anything
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.sm,
                textAlign: 'center',
                paddingHorizontal: spacing.s5,
              }}
            >
              I know your real spending history — ask me why it changed, where it's leaking, or how to hit a goal.
            </Text>
            <View style={[styles.chipsRow, { justifyContent: 'center', marginTop: spacing.s2 }]}>
              {STARTERS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, fontFamily: fonts.medium }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          thinking ? (
            <View style={[styles.assistantBubble, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Analyzing your spending…</Text>
            </View>
          ) : null
        }
      />

      {quotaExhausted && !isPremium ? (
        <View style={[styles.quotaBanner, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.accent, fontSize: fontSize.sm, flex: 1 }}>
            Free questions used up for this month.
          </Text>
          <Button title="Upgrade" size="sm" onPress={() => router.push('/premium')} />
        </View>
      ) : remaining !== null && !isPremium ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', paddingBottom: 4 }}>
          {remaining} free question{remaining === 1 ? '' : 's'} left this month
        </Text>
      ) : null}

      <View style={[styles.inputRow, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your spending…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg }]}
          multiline
          editable={!thinking}
          onSubmitEditing={() => send(input)}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={thinking || !input.trim()}
          style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: thinking || !input.trim() ? 0.5 : 1 }]}
          accessibilityLabel="Send"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
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
    paddingVertical: spacing.s2,
  },
  planStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.s3,
  },
  planTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.s3,
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
