import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { TOUR_STEPS } from '../lib/tourSteps';
import { useOnboardingStore } from '../store/onboardingStore';

/**
 * Marks a live element as spotlightable by the tour. Spread the result onto a
 * `View`:
 *
 *   const total = useTourTarget(TOUR_TARGETS.homeTotal);
 *   <View {...total}><Card>…</Card></View>
 *
 * `collapsable: false` matters on Android: a plain wrapper View with no style
 * gets flattened away by the view optimizer and then measures as 0×0.
 */
export function useTourTarget(id: string) {
  const ref = useRef<View | null>(null);
  const isActive = useOnboardingStore((s) => s.isActive);
  const stepId = useOnboardingStore((s) => (s.isActive ? TOUR_STEPS[s.stepIndex]?.id : undefined));

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      useOnboardingStore.getState().setTargetRect(id, { x, y, width, height });
    });
  }, [id]);

  // Re-measure when the tour opens or advances. The element may have only just
  // mounted (after a route change), or shifted as data loaded in above it, so
  // sample a few times rather than betting on one frame.
  useEffect(() => {
    if (!isActive) return;
    const timers = [0, 120, 350, 700].map((delay) => setTimeout(measure, delay));
    return () => timers.forEach(clearTimeout);
  }, [isActive, stepId, measure]);

  return { ref, onLayout: measure, collapsable: false };
}
