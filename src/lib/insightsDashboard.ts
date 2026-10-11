import type { BriefingInsight, Insight, SpendingIntelligence } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Monday 00:00 local time of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const start = startOfDay(d);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export const weekKey = (now: Date = new Date()) => startOfWeek(now).toDateString();

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** When the briefing's numbers were taken — a refresh moves this forward, createdAt doesn't. */
export function briefingAsOf(briefing: BriefingInsight): Date {
  return new Date(briefing.metadata?.period?.end ?? briefing.period ?? briefing.createdAt);
}

/** Built this calendar week; older ones describe a week that's over. */
export function isBriefingCurrent(briefing: BriefingInsight, now: Date = new Date()): boolean {
  return briefingAsOf(briefing) >= startOfWeek(now);
}

export function updatedLabel(at: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / DAY_MS);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${at.toLocaleDateString('en-US', { weekday: 'short' })}`;
  return `Updated ${shortDate(at)}`;
}

function briefingLabel(briefing: BriefingInsight, now: Date): string {
  const end = briefingAsOf(briefing);
  if (isBriefingCurrent(briefing, now)) return updatedLabel(end, now);
  const start = briefing.metadata?.period?.start
    ? new Date(briefing.metadata.period.start)
    : new Date(end.getTime() - 7 * DAY_MS);
  return `Week of ${shortDate(start)} – ${shortDate(end)}`;
}

export type CategoryDelta = { pct: number } | 'new' | undefined;

export function formatCategoryDelta(delta: CategoryDelta): { label: string; tone: 'warn' | 'new' | 'good' } {
  if (delta === 'new') return { label: 'new', tone: 'new' };
  if (!delta || delta.pct === 0 || Math.abs(delta.pct) <= 8) return { label: 'on track', tone: 'good' };
  if (delta.pct > 0) return { label: `+${delta.pct}%`, tone: 'warn' };
  return { label: `${delta.pct}%`, tone: 'good' };
}

export type WeeklySpendBucket = { key: string; label: string; amount: number; highlight: boolean };

export function buildWeeklySpendingBuckets(
  briefing: BriefingInsight | null | undefined,
  monthlySeries: SpendingIntelligence['monthlySeries'] | undefined,
  now: Date = new Date()
): WeeklySpendBucket[] {
  const base = lastFourMonthlyBuckets(monthlySeries);
  const buckets: WeeklySpendBucket[] =
    base.length > 0
      ? base.map((b, i) => ({
          key: b.key,
          label: b.label,
          amount: b.amount,
          highlight: i === base.length - 1,
        }))
      : [
          { key: 'w1', label: '—', amount: 0, highlight: false },
          { key: 'w2', label: '—', amount: 0, highlight: false },
          { key: 'w3', label: 'Last wk', amount: 0, highlight: false },
          { key: 'w4', label: 'This wk', amount: 0, highlight: true },
        ];

  while (buckets.length < 4) {
    buckets.unshift({ key: `pad-${buckets.length}`, label: '—', amount: 0, highlight: false });
  }
  const four = buckets.slice(-4);

  // A past week's totals would be mislabelled "This wk" — keep the monthly bars instead.
  if (briefing?.metadata && isBriefingCurrent(briefing, now)) {
    const { weekTotal, previousWeekTotal } = briefing.metadata;
    four[2] = { ...four[2], label: 'Last wk', amount: previousWeekTotal, highlight: false };
    four[3] = { ...four[3], label: 'This wk', amount: weekTotal, highlight: true };
  }

  return four;
}

export function usualSpendMarkerPct(current: number, prev: number | undefined): number | null {
  if (!prev || prev <= 0 || current <= 0) return null;
  return Math.min(98, Math.max(2, (prev / current) * 100));
}

export function lastFourMonthlyBuckets(series: SpendingIntelligence['monthlySeries'] | undefined) {
  if (!series?.length) return [];
  return series.slice(-4).map((p) => ({
    key: p.month,
    label: new Date(`${p.month}-01T12:00:00`).toLocaleString('en-US', { month: 'short' }),
    amount: p.total,
  }));
}

export type PrimaryInsightCard = {
  title: string;
  body: string;
  actionLabel: string | null;
  updatedLabel: string;
};

export function buildPrimaryInsight(
  insights: Insight[],
  briefing: BriefingInsight | null,
  intelligence?: SpendingIntelligence | null,
  now: Date = new Date()
): PrimaryInsightCard | null {
  if (briefing?.metadata?.briefing) {
    const b = briefing.metadata.briefing;
    return {
      title: b.title,
      body: b.summary,
      actionLabel: b.recommendations[0] ?? null,
      updatedLabel: briefingLabel(briefing, now),
    };
  }
  const top = insights[0];
  if (top) {
    const title = top.content.split(/[.!?]/)[0]?.trim() || top.content;
    return {
      title,
      body: top.content,
      actionLabel: null,
      updatedLabel: updatedLabel(new Date(top.createdAt), now),
    };
  }
  const anomaly = intelligence?.anomalies?.[0];
  if (anomaly) {
    return {
      title: anomaly.type === 'category_spike' ? 'Unusual category spike' : 'Large transaction',
      body: anomaly.message,
      actionLabel: null,
      updatedLabel: 'Updated today',
    };
  }
  return null;
}
