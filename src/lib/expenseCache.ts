import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from './types';

const PREFIX = 'thoughtexpense-expenses:';

export interface ExpenseListFilters {
  category: string;
  startDate: string;
  endDate: string;
}

export interface CachedExpensePage {
  expenses: Expense[];
  total: number;
  categories: string[];
  savedAt: number;
  page: number;
  filters: ExpenseListFilters;
}

function keyFor(userId: string, page: number, filters: ExpenseListFilters): string {
  return `${PREFIX}${userId}:${page}:${filters.category}|${filters.startDate}|${filters.endDate}`;
}

function latestKey(userId: string): string {
  return `${PREFIX}${userId}:latest`;
}

export async function writeExpenseCache(
  userId: string,
  page: number,
  filters: ExpenseListFilters,
  payload: Omit<CachedExpensePage, 'savedAt' | 'page' | 'filters'>
): Promise<void> {
  const entry: CachedExpensePage = {
    ...payload,
    page,
    filters,
    savedAt: Date.now(),
  };
  const raw = JSON.stringify(entry);
  await AsyncStorage.multiSet([
    [keyFor(userId, page, filters), raw],
    [latestKey(userId), raw],
  ]);
}

export async function readExpenseCache(
  userId: string,
  page: number,
  filters: ExpenseListFilters
): Promise<CachedExpensePage | null> {
  return readKey(keyFor(userId, page, filters));
}

async function readKey(key: string): Promise<CachedExpensePage | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedExpensePage;
    if (!Array.isArray(parsed.expenses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function categoriesKey(userId: string): string {
  return `${PREFIX}${userId}:categories`;
}

export async function writeCategoryCache(userId: string, categories: string[]): Promise<void> {
  await AsyncStorage.setItem(categoriesKey(userId), JSON.stringify(categories));
}

export async function readCategoryCache(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(categoriesKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export function formatCacheAge(savedAt: number): string {
  const mins = Math.round((Date.now() - savedAt) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Wipe every cached list — call on logout so the next account cannot see it. */
export async function clearExpenseCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k) => k.startsWith(PREFIX));
  if (ours.length) await AsyncStorage.multiRemove(ours);
}
