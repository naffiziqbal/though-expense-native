/**
 * When to show the in-app nudges (Premium upsell, turn-on-notifications).
 * Pure functions so the rules are easy to reason about and test.
 */

export type NudgeKind = 'premium' | 'notifications';

export interface NudgeUserState {
  /** Earliest time each nudge may show next (ms). Unset = not scheduled yet. */
  nextAt: Partial<Record<NudgeKind, number>>;
  /** Times each nudge has been shown. */
  shown: Partial<Record<NudgeKind, number>>;
  /** Last time any nudge was shown (ms). */
  lastShownAt?: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Leave brand-new users alone before the first ask. */
export const FIRST_DELAY: Record<NudgeKind, number> = {
  notifications: 1 * DAY,
  premium: 3 * DAY,
};

/** Re-ask every 3–4 days (randomised so it doesn't feel mechanical). */
export const REPEAT_MIN = 3 * DAY;
export const REPEAT_MAX = 4 * DAY;

/** Never show two nudges within this window. */
export const MIN_GAP = 20 * HOUR;

/** Stop asking about notifications after this many declines — it's their call. */
export const MAX_NOTIFICATION_ASKS = 6;

export const emptyNudgeState = (): NudgeUserState => ({ nextAt: {}, shown: {} });

export function nextRepeatAt(now: number, random = Math.random): number {
  return now + REPEAT_MIN + Math.floor(random() * (REPEAT_MAX - REPEAT_MIN));
}

export interface NudgeContext {
  now: number;
  /** Account creation time (ms). */
  signedUpAt: number;
  isPremium: boolean;
  /** Can we usefully ask? 'granted' and 'unavailable' (emulator/Expo Go) skip the nudge. */
  notificationPermission: 'granted' | 'denied' | 'undetermined' | 'unavailable';
}

function isDue(state: NudgeUserState, kind: NudgeKind, ctx: NudgeContext): boolean {
  const scheduled = state.nextAt[kind] ?? ctx.signedUpAt + FIRST_DELAY[kind];
  return ctx.now >= scheduled;
}

/**
 * Which nudge (if any) to show right now. Notifications win when both are due:
 * reminders keep people logging, and engaged users are the ones who upgrade.
 */
export function pickNudge(state: NudgeUserState, ctx: NudgeContext): NudgeKind | null {
  if (state.lastShownAt && ctx.now - state.lastShownAt < MIN_GAP) return null;

  const wantsNotifications =
    (ctx.notificationPermission === 'denied' || ctx.notificationPermission === 'undetermined') &&
    (state.shown.notifications ?? 0) < MAX_NOTIFICATION_ASKS;
  if (wantsNotifications && isDue(state, 'notifications', ctx)) return 'notifications';

  if (!ctx.isPremium && isDue(state, 'premium', ctx)) return 'premium';

  return null;
}

/** Record that `kind` was shown and schedule its next appearance. */
export function markShown(
  state: NudgeUserState,
  kind: NudgeKind,
  now: number,
  random = Math.random
): NudgeUserState {
  return {
    nextAt: { ...state.nextAt, [kind]: nextRepeatAt(now, random) },
    shown: { ...state.shown, [kind]: (state.shown[kind] ?? 0) + 1 },
    lastShownAt: now,
  };
}
