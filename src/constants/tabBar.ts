/** Icon row inside the bottom tab bar (home indicator is added separately). */
export const TAB_BAR_CORE_HEIGHT = 56;

export function tabBarScrollInset(bottomSafeInset: number): number {
  return TAB_BAR_CORE_HEIGHT + bottomSafeInset;
}
