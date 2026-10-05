import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, shape, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IMPORT_ASYNC_STEPS, phaseToStepIndex, type ImportJobPhase } from '../../lib/importDashboard';

type Props = {
  fileName: string | null;
  phase: ImportJobPhase;
  message: string;
  progress?: number;
};

export function ImportAsyncProgressPanel({ fileName, phase, message, progress }: Props) {
  const { colors } = useTheme();
  const activeStep = phaseToStepIndex(phase);
  const terminal = phase === 'failed' || phase === 'cancelled';

  return (
    <View style={{ gap: spacing.s3 }}>
      {fileName ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }} numberOfLines={1}>
          {fileName}
        </Text>
      ) : null}
      <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, lineHeight: 20 }}>{message}</Text>
      {typeof progress === 'number' && progress > 0 && progress < 100 ? (
        <View style={[styles.track, { backgroundColor: colors.bgPrimary }]}>
          <View style={[styles.fill, { width: `${Math.min(100, progress)}%`, backgroundColor: colors.accent }]} />
        </View>
      ) : null}
      {IMPORT_ASYNC_STEPS.map((step, i) => {
        const done = !terminal && activeStep > i;
        const current = !terminal && activeStep === i;
        return (
          <View
            key={step.key}
            style={[
              styles.step,
              {
                borderColor: current ? colors.accent : colors.border,
                backgroundColor: current ? colors.accentSoft : colors.bgCard,
                opacity: !done && !current ? 0.55 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: done ? colors.accent : current ? colors.accent : colors.bgPrimary,
                },
              ]}
            >
              {current && !done ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={{ color: done || current ? colors.onAccent : colors.textMuted, fontSize: fontSize.xs, fontFamily: fonts.semibold }}>
                  {done ? '✓' : i + 1}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>{step.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                {current ? message : step.detail}
              </Text>
            </View>
          </View>
        );
      })}
      {!terminal ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18 }}>
          This usually takes under a minute. You can close this sheet — import continues in the background.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s3,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.s3,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: shape.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
