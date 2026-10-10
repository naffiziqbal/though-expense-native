import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

/**
 * Price copy for upsells, from the store's own localized prices. Google Play / the App Store
 * already return the user's regional price and currency (whatever is set per country in
 * Play Console), so we never format or convert amounts ourselves.
 */
export interface PremiumOfferCopy {
  /** e.g. "From ৳250/month, billed yearly" */
  headline: string | null;
  /** e.g. "7-day free trial" */
  trial: string | null;
}

function trialLabel(pkg: PurchasesPackage | undefined): string | null {
  if (!pkg) return null;
  const period = pkg.product.defaultOption?.freePhase?.billingPeriod;
  if (period && period.value > 0) {
    const unit = period.unit.toLowerCase(); // DAY | WEEK | MONTH | YEAR
    if (unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year') {
      return `${period.value}-${unit} free trial`;
    }
  }
  const intro = pkg.product.introPrice; // iOS-style free intro offer
  if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
    return `${intro.periodNumberOfUnits}-${intro.periodUnit.toLowerCase()} free trial`;
  }
  return null;
}

export function premiumOfferCopy(offering: PurchasesOffering | null): PremiumOfferCopy {
  const packages = offering?.availablePackages ?? [];
  const annual = packages.find((p) => p.packageType === 'ANNUAL');
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const lifetime = packages.find((p) => p.packageType === 'LIFETIME');

  let headline: string | null = null;
  if (annual?.product.pricePerMonthString) {
    headline = `From ${annual.product.pricePerMonthString}/month, billed yearly`;
  } else if (monthly) {
    headline = `${monthly.product.priceString}/month`;
  } else if (annual) {
    headline = `${annual.product.priceString}/year`;
  } else if (lifetime) {
    headline = `${lifetime.product.priceString} once — yours forever`;
  }

  return { headline, trial: trialLabel(annual) ?? trialLabel(monthly) };
}
