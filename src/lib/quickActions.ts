import * as QuickActions from 'expo-quick-actions';

/**
 * Home-screen long-press shortcuts. Android shows at most 4; iOS at most 4.
 * `params.href` is what expo-quick-actions/router navigates to.
 */
const ACTIONS: QuickActions.Action[] = [
  {
    id: 'log-expense',
    title: 'Log expense',
    subtitle: 'Type it in plain language',
    icon: 'symbol:plus.circle.fill',
    params: { href: '/(tabs)/add' },
  },
  {
    id: 'expenses',
    title: 'Recent expenses',
    icon: 'symbol:list.bullet',
    params: { href: '/(tabs)/expenses' },
  },
  {
    id: 'insights',
    title: 'This month',
    icon: 'symbol:chart.pie.fill',
    params: { href: '/(tabs)/insights' },
  },
];

/** Safe to call on every launch; a failure here is never worth surfacing. */
export async function syncQuickActions(): Promise<void> {
  try {
    if (!(await QuickActions.isSupported())) return;
    await QuickActions.setItems(ACTIONS);
  } catch {
    // Launcher doesn't support shortcuts.
  }
}

export async function clearQuickActions(): Promise<void> {
  try {
    await QuickActions.setItems([]);
  } catch {
    // ignore
  }
}
