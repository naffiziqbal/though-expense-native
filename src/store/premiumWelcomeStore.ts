import { create } from 'zustand';

interface PremiumWelcomeState {
  visible: boolean;
  open: () => void;
  close: () => void;
}

export const usePremiumWelcomeStore = create<PremiumWelcomeState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));

/** Show welcome once when a user moves from free to Premium in this session. */
export function celebratePremiumUpgrade(wasPremium: boolean | undefined, isPremium: boolean): void {
  if (wasPremium === true || !isPremium) return;
  usePremiumWelcomeStore.getState().open();
}
