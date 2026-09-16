import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** True when a DSN is configured; otherwise every helper here is a no-op. */
export const isSentryEnabled = Boolean(dsn);

export function initSentry(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Crash reporting is the goal; performance traces are sampled thinly.
    tracesSampleRate: __DEV__ ? 0 : 0.1,
    enabled: !__DEV__,
    sendDefaultPii: false,
    // Expense text can contain personal detail — keep it out of breadcrumbs.
    maxBreadcrumbs: 50,
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.category === 'console') return null;
      return breadcrumb;
    },
  });
}

/** Attach the signed-in user so crashes can be grouped per account. */
export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (!dsn) return;
  Sentry.setUser(user ? { id: user.id } : null);
}

/** Report a handled error that the user was shielded from. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
