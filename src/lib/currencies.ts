import { getLocales } from 'expo-localization';

export const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'BDT', label: 'BDT - Bangladeshi Taka (৳)' },
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'PKR', label: 'PKR - Pakistani Rupee (Rs)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar ($)' },
  { value: 'AUD', label: 'AUD - Australian Dollar ($)' },
] as const;

export function getDefaultCurrency(): string {
  try {
    const locales = getLocales();
    const first = locales?.[0];
    if (first?.currencyCode) return first.currencyCode;
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
