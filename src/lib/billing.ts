/**
 * Google Play subscriptions via RevenueCat.
 * Inactive until EXPO_PUBLIC_REVENUECAT_ANDROID_KEY is set (requires a
 * Play merchant account + RevenueCat project). All calls no-op gracefully
 * while unconfigured. Entitlement id: "premium".
 */
import Purchases, { LOG_LEVEL, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';
const ENTITLEMENT_ID = 'premium';

let configured = false;

export function billingAvailable(): boolean {
  return !!API_KEY;
}

/** Configure once at startup; safe to call repeatedly. */
export function configureBilling(userId?: string | null): void {
  if (!API_KEY || configured) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey: API_KEY, appUserID: userId ?? null });
    configured = true;
  } catch (err) {
    console.warn('Billing configure failed:', err);
  }
}

/** Tie purchases to our backend user id so webhooks can map them. */
export async function identifyBilling(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn('Billing logIn failed:', err);
  }
}

export async function resetBilling(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // already anonymous
  }
}

export async function getPremiumOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (err) {
    console.warn('getOfferings failed:', err);
    return null;
  }
}

/** Returns true when the premium entitlement is active after purchase. */
export async function purchasePremium(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}

/** Returns true when a previous purchase restores the premium entitlement. */
export async function restorePurchases(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}
