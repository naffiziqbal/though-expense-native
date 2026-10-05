// Ported from client/lib/utils.ts (RN flavor: colors as hex values, no tailwind classes)
import { format, parseISO } from 'date-fns';

const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  BDT: '৳',
  INR: '₹',
  PKR: 'Rs ',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

const currencyCodeMap: Record<string, string> = {
  TK: 'BDT',
  Rs: 'INR',
  PKR: 'PKR',
  '₹': 'INR',
  '৳': 'BDT',
};

export function currencyCodeForDisplay(currency: string): string {
  return currencyCodeMap[currency] || currency;
}

/** Stacked amount column (code + negative value) for expense rows. */
export function formatExpenseAmountParts(amount: number, currency: string): { code: string; value: string } {
  return {
    code: currencyCodeForDisplay(currency),
    value: `-${amount.toFixed(2)}`,
  };
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const mapped = currencyCodeMap[currency] || currency;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: mapped,
    }).format(amount);
  } catch {
    const symbol = SYMBOLS[mapped] || `${mapped} `;
    return `${symbol}${amount.toFixed(2)}`;
  }
}

export function formatDate(dateString: string, formatString: string = 'MMM dd, yyyy'): string {
  try {
    return format(parseISO(dateString), formatString);
  } catch {
    return dateString;
  }
}

export function formatRelativeDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  } catch {
    return dateString;
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return '#16A34A';
  if (confidence >= 0.7) return '#CA8A04';
  if (confidence >= 0.5) return '#EA580C';
  return '#DC2626';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Badge colors: [background, text] pairs (light tints; readable in both themes) */
const CATEGORY_BADGES: Record<string, [string, string]> = {
  Food: ['#DBEAFE', '#1E40AF'],
  Transport: ['#F3E8FF', '#6B21A8'],
  Rent: ['#FEE2E2', '#991B1B'],
  Utilities: ['#FEF9C3', '#854D0E'],
  Shopping: ['#FCE7F3', '#9D174D'],
  Entertainment: ['#E0E7FF', '#3730A3'],
  Healthcare: ['#DCFCE7', '#166534'],
  Education: ['#CCFBF1', '#115E59'],
  'Personal Care': ['#FFEDD5', '#9A3412'],
  Fees: ['#F3F4F6', '#1F2937'],
  Other: ['#F1F5F9', '#0F172A'],
};

const BADGE_PALETTE: [string, string][] = [
  ['#DBEAFE', '#1E40AF'],
  ['#F3E8FF', '#6B21A8'],
  ['#FCE7F3', '#9D174D'],
  ['#E0E7FF', '#3730A3'],
  ['#DCFCE7', '#166534'],
  ['#CCFBF1', '#115E59'],
  ['#FFEDD5', '#9A3412'],
  ['#CFFAFE', '#155E75'],
  ['#ECFCCB', '#3F6212'],
  ['#FEF3C7', '#92400E'],
  ['#FFE4E6', '#9F1239'],
  ['#EDE9FE', '#5B21B6'],
];

/** Dark-mode pairs: translucent hue backgrounds + bright text, tuned for #121A2A cards */
const CATEGORY_BADGES_DARK: Record<string, [string, string]> = {
  Food: ['rgba(217, 150, 60, 0.18)', '#F0B267'],
  Transport: ['rgba(93, 124, 220, 0.2)', '#9DB2F5'],
  Rent: ['rgba(220, 80, 80, 0.18)', '#F0A0A0'],
  Utilities: ['rgba(202, 164, 32, 0.18)', '#E2C55C'],
  Shopping: ['rgba(230, 100, 160, 0.18)', '#F096C0'],
  Entertainment: ['rgba(120, 134, 240, 0.2)', '#AEB8F8'],
  Healthcare: ['rgba(70, 180, 120, 0.18)', '#7BD8A5'],
  Education: ['rgba(45, 183, 172, 0.18)', '#6FDCD2'],
  'Personal Care': ['rgba(240, 140, 80, 0.18)', '#F5AE84'],
  Fees: ['rgba(148, 163, 184, 0.18)', '#C4CEDB'],
  Other: ['rgba(148, 163, 184, 0.14)', '#B9C2CE'],
};

const BADGE_PALETTE_DARK: [string, string][] = [
  ['rgba(96, 145, 240, 0.2)', '#9DB2F5'],
  ['rgba(167, 110, 240, 0.2)', '#C9A8F5'],
  ['rgba(230, 100, 160, 0.2)', '#F096C0'],
  ['rgba(120, 134, 240, 0.2)', '#AEB8F8'],
  ['rgba(70, 180, 120, 0.2)', '#7BD8A5'],
  ['rgba(45, 183, 172, 0.2)', '#6FDCD2'],
  ['rgba(240, 140, 80, 0.2)', '#F5AE84'],
  ['rgba(60, 180, 220, 0.2)', '#7FD4EE'],
  ['rgba(140, 200, 60, 0.2)', '#BCE380'],
  ['rgba(220, 170, 40, 0.2)', '#E8C866'],
  ['rgba(240, 100, 120, 0.2)', '#F5A0B0'],
  ['rgba(150, 120, 245, 0.2)', '#C0B0F8'],
];

export function getCategoryBadgeColors(category: string, dark = false): { bg: string; text: string } {
  const map = dark ? CATEGORY_BADGES_DARK : CATEGORY_BADGES;
  const palette = dark ? BADGE_PALETTE_DARK : BADGE_PALETTE;
  const pair = map[category] || palette[hashString(category) % palette.length];
  return { bg: pair[0], text: pair[1] };
}

/** Semantic data viz palette per design spec (ported from getCategoryChartColor) */
export function getCategoryChartColor(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('rent') || lower.includes('housing') || lower.includes('utilities')) return '#3B82F6';
  if (
    lower.includes('food') ||
    lower.includes('transport') ||
    lower.includes('shopping') ||
    lower.includes('entertainment') ||
    lower.includes('personal')
  )
    return '#F59E0B';
  if (lower.includes('health') || lower.includes('doctor') || lower.includes('medical')) return '#EF4444';
  if (lower.includes('education') || lower.includes('savings')) return '#10B981';
  const fallbackPalette = ['#0EA5A4', '#8B5CF6', '#3B82F6', '#9CA3AF'];
  return fallbackPalette[hashString(category) % fallbackPalette.length];
}

/** Distinct chart colors for donut slices (index-based so adjacent slices differ) */
export const CHART_SLICE_COLORS = [
  '#0EA5A4',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#6366F1',
  '#84CC16',
  '#F97316',
  '#9CA3AF',
];

export interface ParsedExpensePreview {
  description: string;
  amount: number;
  rawInput: string;
}

/** Local parsing for Quick Log live preview (works offline) */
export function parseExpenseInputLocally(input: string): ParsedExpensePreview[] {
  if (!input.trim()) return [];
  const items = input
    .split(/[\n,]+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const results: ParsedExpensePreview[] = [];
  for (const item of items) {
    const endNumberMatch = item.match(/^(.+?)\s+(\d+(?:\.\d{1,2})?)\s*$/);
    const startNumberMatch = item.match(/^(\d+(?:\.\d{1,2})?)\s+(.+)$/);
    if (endNumberMatch) {
      results.push({
        description: endNumberMatch[1].trim(),
        amount: parseFloat(endNumberMatch[2]),
        rawInput: item,
      });
    } else if (startNumberMatch) {
      results.push({
        description: startNumberMatch[2].trim(),
        amount: parseFloat(startNumberMatch[1]),
        rawInput: item,
      });
    } else {
      const numbers = item.match(/\d+(?:\.\d{1,2})?/g);
      if (numbers && numbers.length > 0) {
        results.push({ description: 'Unknown', amount: parseFloat(numbers[0]), rawInput: item });
      }
    }
  }
  return results;
}

/** Clean expense description: remove "3." prefix and "- 971TK" suffix */
export function cleanExpenseDescription(description: string): string {
  return (
    description
      .replace(/^\d+\.\s*/, '')
      .replace(/\s*[-–—]\s*[\d,.]+\s*(?:[A-Z]{2,4}|[A-Za-z]+)?\s*$/i, '')
      .trim() || description
  );
}

export function getCategoryFromKeyword(description: string): string {
  const lower = description.toLowerCase();
  const keywords: Record<string, string[]> = {
    Food: ['coffee', 'lunch', 'dinner', 'breakfast', 'burger', 'pizza', 'restaurant', 'food', 'groceries', 'grocery', 'snack'],
    Transport: ['uber', 'taxi', 'bus', 'metro', 'rickshaw', 'petrol', 'fuel', 'parking'],
    Rent: ['rent', 'lease'],
    Utilities: ['electricity', 'water', 'internet', 'bill', 'utilities'],
    Shopping: ['shopping', 'mall', 'store', 'amazon'],
    Entertainment: ['movie', 'netflix', 'spotify', 'game'],
    Healthcare: ['doctor', 'medicine', 'pharmacy', 'hospital'],
    Education: ['course', 'book', 'tuition'],
    'Personal Care': ['salon', 'haircut', 'gym'],
    Fees: ['fee', 'subscription', 'membership'],
  };
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((w) => lower.includes(w))) return category;
  }
  return 'Other';
}

/** Build full image URL from stored path using EXPO_PUBLIC_SPACES_URL */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const base = process.env.EXPO_PUBLIC_SPACES_URL;
  if (!base) return null;
  const baseTrimmed = base.replace(/\/$/, '');
  const pathTrimmed = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${baseTrimmed}${pathTrimmed}`;
}
