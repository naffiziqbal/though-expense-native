import type { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICONS: Record<string, IoniconName> = {
  Food: 'restaurant',
  Transport: 'car',
  Rent: 'home',
  Utilities: 'flash',
  Shopping: 'bag-handle',
  Entertainment: 'film',
  Healthcare: 'medkit',
  Education: 'school',
  'Personal Care': 'sparkles',
  Fees: 'card',
  Other: 'cube',
};

const KEYWORD_ICONS: Array<[string[], IoniconName]> = [
  [['food', 'lunch', 'dinner', 'breakfast', 'grocer', 'coffee', 'restaurant', 'snack'], 'restaurant'],
  [['transport', 'uber', 'taxi', 'bus', 'fuel', 'gas', 'car', 'travel'], 'car'],
  [['rent', 'housing', 'home', 'lease'], 'home'],
  [['utilit', 'electric', 'water', 'internet', 'bill'], 'flash'],
  [['shop', 'mall', 'cloth', 'amazon'], 'bag-handle'],
  [['entertain', 'movie', 'game', 'music', 'netflix'], 'film'],
  [['health', 'medic', 'doctor', 'pharma', 'hospital'], 'medkit'],
  [['educat', 'school', 'course', 'book', 'tuition'], 'school'],
  [['personal', 'salon', 'gym', 'fitness', 'hair'], 'sparkles'],
  [['fee', 'subscription', 'member', 'bank'], 'card'],
];

export function getCategoryIcon(category: string): IoniconName {
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  const lower = category.toLowerCase();
  for (const [keywords, icon] of KEYWORD_ICONS) {
    if (keywords.some((k) => lower.includes(k))) return icon;
  }
  return 'pricetag';
}

/** Emoji per category for budget breakdown cards (ported from budget page). */
const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍽️',
  groceries: '🥬',
  grocery: '🥬',
  rent: '🏠',
  transport: '🚗',
  transportation: '🚗',
  gas: '⛽',
  fuel: '⛽',
  health: '❤️',
  medical: '🏥',
  healthcare: '🏥',
  entertainment: '🎬',
  utilities: '💡',
  shopping: '🛍️',
  education: '📚',
  dining: '🍴',
  fitness: '💪',
  gym: '💪',
  subscriptions: '📱',
  travel: '✈️',
  other: '📦',
};

export function getCategoryEmoji(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_EMOJI[key] ?? '📦';
}
