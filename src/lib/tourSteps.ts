/**
 * The guided tour: a mascot walks a new user through the real UI rather than
 * a slideshow. Every step with a `target` spotlights a live element, so the
 * ids here must stay in sync with the `useTourTarget` calls in the screens.
 *
 * Targets must be reachable without scrolling — the overlay measures whatever
 * is currently on screen and does not scroll the page for you.
 */

export const TOUR_TARGETS = {
  homeTotal: 'home-total',
  homeBudget: 'home-budget',
  tabAdd: 'tab-add',
  tabInsights: 'tab-insights',
  addInput: 'add-input',
  addSave: 'add-save',
} as const;

export interface TourStep {
  id: string;
  /** Element to spotlight. Omitted for a centered, full-attention step. */
  target?: string;
  /** Route the tour moves to before showing this step. */
  route?: '/(tabs)' | '/(tabs)/add';
  title: string;
  body: string;
  /** Overrides the default "Next" label. */
  cta?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/(tabs)',
    title: 'Hi, I’m Penny 👋',
    body: 'Give me 30 seconds and I’ll show you how to track everything you spend — without filling in a single form.',
    cta: 'Show me',
  },
  {
    id: 'total',
    route: '/(tabs)',
    target: TOUR_TARGETS.homeTotal,
    title: 'Your month, at a glance',
    body: 'Everything you log rolls up here: total spent, how many transactions, and what’s still safe to spend.',
  },
  {
    id: 'budget',
    route: '/(tabs)',
    target: TOUR_TARGETS.homeBudget,
    title: 'Stay ahead of your budget',
    body: 'Set a monthly limit and I’ll nudge you at 80% — so the end of the month never surprises you.',
  },
  {
    id: 'add-button',
    route: '/(tabs)',
    target: TOUR_TARGETS.tabAdd,
    title: 'Everything starts here',
    body: 'This button is the whole app. Tap it whenever you spend something.',
    cta: 'Open it',
  },
  {
    id: 'input',
    route: '/(tabs)/add',
    target: TOUR_TARGETS.addInput,
    title: 'Just type it out',
    body: 'Write it like a text message — “coffee 120, uber 250”. Multiple expenses in one line is fine.',
  },
  {
    id: 'parse',
    route: '/(tabs)/add',
    target: TOUR_TARGETS.addSave,
    title: 'I’ll do the boring part',
    body: 'I split each item, work out the amount, and pick a category. Tap any row later to correct me.',
  },
  {
    id: 'insights',
    route: '/(tabs)',
    target: TOUR_TARGETS.tabInsights,
    title: 'Insights & your advisor',
    body: 'Charts, recurring bills, and an AI advisor that answers using your real numbers — all in here.',
  },
  {
    id: 'done',
    route: '/(tabs)',
    title: 'That’s the whole tour',
    body: 'Log your first expense and I’ll take it from there. You can replay this any time from your profile.',
    cta: 'Log my first expense',
  },
];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;
