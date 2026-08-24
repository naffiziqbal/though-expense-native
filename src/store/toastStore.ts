import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  type: ToastType;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'info',
  show: (message, type = 'info') => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, type });
    hideTimer = setTimeout(() => set({ message: null }), 2800);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));

export const toast = {
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  info: (message: string) => useToastStore.getState().show(message, 'info'),
};
