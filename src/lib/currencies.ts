import { getLocales } from 'expo-localization';
import { getIso4217Currency, normalizeIso4217Code, type Iso4217Currency } from './iso4217';

export type CurrencyOption = Iso4217Currency;

export const CURRENCY_DISPLAY_HINT =
  'Tap a currency to change your display currency. Amounts in the app use exchange rates to show in the code you pick.';

export const SIGNUP_CURRENCY_HINT =
  'Your dashboard and budgets use this currency. Expenses in other currencies convert using exchange rates when you add them.';

export function currencyChangeConsentTitle(code: string): string {
  return `Switch to ${code}?`;
}

export function currencyChangeConsentBody(code: string, name: string, fromCode: string): string {
  return `Your display currency will change from ${fromCode} to ${code} (${name}). Dashboard totals, budgets, insights, and exports will show amounts converted to ${code}, including your existing expenses in summaries.`;
}

export function findCurrency(code: string, locale = 'en'): CurrencyOption | null {
  return getIso4217Currency(code, locale);
}

export function getDefaultCurrency(): string {
  try {
    const locales = getLocales();
    const first = locales?.[0];
    if (first?.currencyCode) {
      const normalized = normalizeIso4217Code(first.currencyCode);
      if (normalized) return normalized;
    }
    const tag = first?.languageTag?.toLowerCase() || '';
    if (tag.includes('gb')) return 'GBP';
    if (tag.includes('bd') || tag.startsWith('bn')) return 'BDT';
    if (tag.includes('in') || tag.startsWith('hi')) return 'INR';
    if (tag.includes('pk') || tag.startsWith('ur')) return 'PKR';
    if (tag.startsWith('ja')) return 'JPY';
    if (tag.startsWith('fr') || tag.startsWith('de') || tag.startsWith('es')) return 'EUR';
  } catch {
    // ignore
  }
  return 'USD';
}

export {
  getIso4217Currency,
  listIso4217Currencies,
  listIso4217CurrenciesGrouped,
  normalizeIso4217Code,
  searchIso4217Currencies,
  POPULAR_ISO4217_CODES,
  ISO4217_CODES,
} from './iso4217';
