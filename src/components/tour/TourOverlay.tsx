import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { TOUR_STEPS } from '../../lib/tourSteps';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore, type TourRect } from '../../store/onboardingStore';
import { Mascot } from './Mascot';

const DIM = 'rgba(6, 18, 24, 0.78)';
const HOLE_PADDING = 10;
const HOLE_RADIUS = 18;
/** Used before the bubble has measured itself, to pick a side without a flash. */
const ESTIMATED_BLOCK_HEIGHT = 210;

function inflate(rect: TourRect, by: number): TourRect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2,
  };
}

/**
 * The guided tour. Mounted once at the root so it can dim the tab bar too.
 * Tapping anywhere advances — the tour drives its own navigation rather than
 * asking the user to hit a specific element, which is far more forgiving.
 */
export function TourOverlay() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const userId = useAuthStore((s) => s.user?.id);
  const isActive = useOnboardingStore((s) => s.isActive);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const targets = useOnboardingStore((s) => s.targets);
  const next = useOnboardingStore((s) => s.next);
  const finish = useOnboardingStore((s) => s.finish);

  const [blockHeight, setBlockHeight] = useState(ESTIMATED_BLOCK_HEIGHT);
  const lastRoute = useRef<string | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  // Each step owns its screen: move there before spotlighting anything on it.
  useEffect(() => {
    if (!isActive || !step?.route) return;
    if (lastRoute.current === step.route) return;
    lastRoute.current = step.route;
    router.replace(step.route);
  }, [isActive, router, step?.route]);

  useEffect(() => {
    if (!isActive) lastRoute.current = null;
  }, [isActive]);

  const complete = useCallback(() => {
    finish(userId);
    router.replace('/(tabs)/add');
  }, [finish, router, userId]);

  const advance = useCallback(() => {
    if (isLast) complete();
    else next();
  }, [complete, isLast, next]);

  const rect = step?.target ? targets[step.target] : undefined;
  const hole = useMemo(() => (rect ? inflate(rect, HOLE_PADDING) : null), [rect]);

  // Below the spotlight when there's room, otherwise above it.
  const blockTop = useMemo(() => {
    if (!hole) return Math.max(insets.top + spacing.s6, (screenHeight - blockHeight) / 2);
    const below = hole.y + hole.height + spacing.s4;
    if (below + blockHeight < screenHeight - insets.bottom - spacing.s4) return below;
    return Math.max(insets.top + spacing.s3, hole.y - blockHeight - spacing.s4);
  }, [blockHeight, hole, insets.bottom, insets.top, screenHeight]);

  const onBlockLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (Math.abs(measured - blockHeight) > 2) setBlockHeight(measured);
  };

  if (!isActive || !step) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={advance} accessibilityRole="button">
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
          <Svg width={screenWidth} height={screenHeight}>
            <Defs>
              <Mask id="tourHole">
                <Rect x={0} y={0} width={screenWidth} height={screenHeight} fill="#ffffff" />
                {hole ? (
                  <Rect
                    x={hole.x}
                    y={hole.y}
                    width={hole.width}
                    height={hole.height}
                    rx={HOLE_RADIUS}
                    ry={HOLE_RADIUS}
                    fill="#000000"
                  />
                ) : null}
              </Mask>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={screenWidth}
              height={screenHeight}
              fill={DIM}
              mask="url(#tourHole)"
            />
            {hole ? (
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={HOLE_RADIUS}
                ry={HOLE_RADIUS}
                fill="none"
                stroke="#2DD4BF"
                strokeWidth={2.5}
              />
            ) : null}
          </Svg>
        </Animated.View>
      </Pressable>

      <Pressable
        onPress={() => finish(userId)}
        hitSlop={10}
        style={[styles.skip, { top: insets.top + spacing.s2 }]}
      >
        <Text style={styles.skipText}>Skip tour</Text>
      </Pressable>

      <Animated.View
        key={step.id}
        entering={FadeInDown.duration(260)}
        onLayout={onBlockLayout}
        style={[styles.block, { top: blockTop }]}
        pointerEvents="box-none"
      >
        <View style={styles.mascotColumn}>
          <Mascot size={74} poseKey={stepIndex} />
        </View>

        <View style={[styles.bubble, { backgroundColor: colors.bgCard }]}>
          <View style={[styles.tail, { borderRightColor: colors.bgCard }]} />

          <Text style={[styles.title, { color: colors.textPrimary }]}>{step.title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {TOUR_STEPS.map((s, i) => (
                <View
                  key={s.id}
                  style={[
                    styles.dot,
                    i === stepIndex
                      ? { width: 18, backgroundColor: colors.accent }
                      : { backgroundColor: colors.border },
                  ]}
                />
              ))}
            </View>

            <Pressable
              onPress={advance}
              style={[styles.cta, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaText, { color: colors.onAccent }]}>
                {step.cta ?? (isLast ? 'Finish' : 'Next')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  skip: {
    position: 'absolute',
    right: spacing.s4,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  skipText: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
  },
  block: {
    position: 'absolute',
    left: spacing.s4,
    right: spacing.s4,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  mascotColumn: {
    width: 74,
    marginRight: -2,
  },
  bubble: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.s4,
    gap: spacing.s2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  // Little pointer from the bubble back toward Penny.
  tail: {
    position: 'absolute',
    left: -7,
    bottom: 26,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
  },
  body: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s3,
    marginTop: spacing.s2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  cta: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.s4,
    minHeight: 38,
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
  },
});
