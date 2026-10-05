import { getLocales } from 'expo-localization';
import { getIso4217Currency, normalizeIso4217Code, type Iso4217Currency } from './iso4217';

export type CurrencyOption = Iso4217Currency;

export const CURRENCY_DISPLAY_HINT =
  'Dashboard, budgets, and exports use this currency. Expenses in other currencies convert when you add them.';

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
