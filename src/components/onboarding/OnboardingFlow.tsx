import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Button } from '../ui/Button';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { ONBOARDING_STEPS, PARSED_DEMO, TYPING_DEMO, type OnboardingStep } from '../../lib/onboardingSteps';

interface OnboardingFlowProps {
  onComplete: () => void;
}

function TypingDemo() {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    let i = 0;
    const type = setInterval(() => {
      i += 1;
      setText(TYPING_DEMO.slice(0, i));
      if (i >= TYPING_DEMO.length) clearInterval(type);
    }, 70);
    const blink = setInterval(() => setCursorOn((v) => !v), 500);
    return () => {
      clearInterval(type);
      clearInterval(blink);
    };
  }, []);

  return (
    <View style={[styles.demoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.demoLabel, { color: colors.textMuted }]}>QUICK LOG</Text>
      <Text style={[styles.typingText, { color: colors.textPrimary }]}>
        {text}
        <Text style={{ color: colors.accent, opacity: cursorOn ? 1 : 0 }}>|</Text>
      </Text>
    </View>
  );
}

function ParseDemo() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(1), 400);
    const t2 = setTimeout(() => setVisible(2), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <View style={{ width: '100%', gap: spacing.s3 }}>
      {PARSED_DEMO.map((item, idx) => (
        <Animated.View
          key={item.label}
          entering={idx < visible ? FadeInDown.delay(idx * 200).duration(400) : undefined}
          style={[
            styles.parseRow,
            { backgroundColor: colors.bgCard, borderColor: colors.border, opacity: idx < visible ? 1 : 0 },
          ]}
        >
          <View>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>{item.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{item.category}</Text>
          </View>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.bold }}>${item.amount}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function BudgetDemo() {
  const { colors } = useTheme();
  const [pct] = useState(42);
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <View style={[styles.demoCard, styles.budgetCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Svg width={120} height={120} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx="50" cy="50" r={r} stroke={colors.border} strokeWidth={10} fill="none" />
        <Circle
          cx="50"
          cy="50"
          r={r}
          stroke={colors.accent}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text style={[styles.budgetPct, { color: colors.textPrimary }]}>{pct}%</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>of monthly budget</Text>
    </View>
  );
}

function InsightsDemo() {
  const { colors } = useTheme();
  const bars = [40, 72, 55, 88, 48];

  return (
    <View style={[styles.demoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.barRow}>
        {bars.map((h, i) => (
          <Animated.View
            key={i}
            entering={FadeInUp.delay(i * 100).duration(500)}
            style={[styles.bar, { height: `${h}%`, backgroundColor: colors.accent }]}
          />
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.s4 }}>
        Spending by category
      </Text>
    </View>
  );
}

function StepDemo({ demo }: { demo: OnboardingStep['demo'] }) {
  switch (demo) {
    case 'typing':
      return <TypingDemo />;
    case 'parse':
      return <ParseDemo />;
    case 'budget':
      return <BudgetDemo />;
    case 'insights':
      return <InsightsDemo />;
  }
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setStep((s) => s + 1);
    setAnimKey((k) => k + 1);
  }, [isLast, onComplete]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.bgPrimary, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.skipRow}>
        <Pressable onPress={onComplete} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontFamily: fonts.medium, fontSize: fontSize.sm }}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Animated.View key={animKey} entering={FadeIn.duration(350)} style={styles.demoWrap}>
          <StepDemo demo={current.demo} />
        </Animated.View>

        <Animated.View key={`t-${animKey}`} entering={FadeIn.delay(100).duration(350)} style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{current.subtitle}</Text>
        </Animated.View>

        <View style={styles.dots}>
          {ONBOARDING_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === step ? colors.accent : colors.border,
                  width: i === step ? 28 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button title={isLast ? 'Log my first expense' : 'Next'} onPress={goNext} size="lg" style={{ width: '100%' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: spacing.s5, paddingTop: spacing.s4 },
  body: {
    flex: 1,
    paddingHorizontal: spacing.s6,
    paddingBottom: spacing.s8,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  demoWrap: { marginBottom: spacing.s7, width: '100%' },
  demoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.s5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  demoLabel: { fontSize: fontSize.xs, fontFamily: fonts.semibold, letterSpacing: 1, marginBottom: spacing.s3 },
  typingText: { fontSize: fontSize.lg, fontFamily: fonts.medium, minHeight: 28 },
  parseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
  },
  budgetCard: { alignItems: 'center', paddingVertical: spacing.s6 },
  budgetPct: { fontSize: fontSize.xxl, fontFamily: fonts.bold, marginTop: -spacing.s2 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.s2, height: 120 },
  bar: { width: 28, borderRadius: radius.sm, opacity: 0.85 },
  textBlock: { marginBottom: spacing.s6 },
  title: { fontSize: fontSize.xl, fontFamily: fonts.bold, textAlign: 'center', marginBottom: spacing.s3 },
  subtitle: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.s2, marginBottom: spacing.s6 },
  dot: { height: 8, borderRadius: radius.full },
});
