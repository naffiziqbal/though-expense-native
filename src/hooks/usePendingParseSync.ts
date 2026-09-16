import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { usePendingStore } from '../store/pendingStore';

export function usePendingParseSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const items = usePendingStore((s) => s.items);
  const removeByJobId = usePendingStore((s) => s.removeByJobId);
  const ticking = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const poll = async () => {
      if (ticking.current) return;
      const jobs = [...new Set(usePendingStore.getState().items.map((p) => p.jobId).filter(Boolean))];
      if (jobs.length === 0) return;
      ticking.current = true;
      try {
        for (const jobId of jobs) {
          try {
            const res = await api.getParseJobStatus(jobId);
            const status = res.data?.status;
            if (status === 'completed') {
              removeByJobId(jobId);
            }
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 404 || status === 401 || status === 403) {
              removeByJobId(jobId);
            }
          }
        }
      } finally {
        ticking.current = false;
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated, isLoading, items, removeByJobId]);
}
