import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useOutboxStore, type OutboxBatch } from '../store/outboxStore';
import { usePendingStore } from '../store/pendingStore';
import { toast } from '../store/toastStore';

/** Give up after this many tries so one bad batch can't block the queue forever. */
const MAX_ATTEMPTS = 6;

async function flushBatch(batch: OutboxBatch): Promise<'sent' | 'retry' | 'drop'> {
  try {
    const res = await api.enqueueParseExpenses(
      {
        rawInput: batch.rawInput,
        create: true,
        localPreview: batch.items,
        clientBatchId: batch.id,
      },
      batch.id
    );

    // Hand off to the existing parse-job poller so the optimistic row survives
    // until the server confirms it.
    usePendingStore.getState().enqueue(
      batch.items.map((item, i) => ({
        localId: `${batch.id}-${i}`,
        jobId: res.data.jobId,
        batchId: batch.id,
        description: item.description,
        amount: item.amount,
        currency: item.currency,
        category: item.category,
        date: item.date,
        rawInput: item.rawInput,
        createdAt: batch.createdAt,
      }))
    );
    return 'sent';
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    // 429 = rate limited, 409 = the server is still processing this same key.
    const transient = status === 429 || status === 409;
    if (status && status >= 400 && status < 500 && !transient) return 'drop';
    return batch.attempts + 1 >= MAX_ATTEMPTS ? 'drop' : 'retry';
  }
}

/**
 * Drains the offline outbox whenever the device is online and signed in.
 * Returns the current connectivity state for the offline banner.
 */
export function useOutboxSync(): { isOffline: boolean; queuedCount: number } {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const batches = useOutboxStore((s) => s.batches);
  const [isOffline, setIsOffline] = useState(false);
  const flushing = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null until the first probe resolves; treat
      // unknown as online so we never show a false offline banner.
      setIsOffline(!state.isConnected || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || isOffline) return;
    if (useOutboxStore.getState().batches.length === 0) return;

    const flush = async () => {
      if (flushing.current) return;
      flushing.current = true;

      let sent = 0;
      let dropped = 0;
      try {
        for (const batch of useOutboxStore.getState().batches) {
          const outcome = await flushBatch(batch);
          if (outcome === 'sent') {
            useOutboxStore.getState().remove(batch.id);
            sent += 1;
          } else if (outcome === 'drop') {
            useOutboxStore.getState().remove(batch.id);
            dropped += 1;
          } else {
            useOutboxStore.getState().markAttempt(batch.id);
            break; // Likely still offline; stop and wait for the next trigger.
          }
        }
      } finally {
        flushing.current = false;
      }

      if (sent > 0) toast.success(sent === 1 ? 'Offline expense synced' : `${sent} offline saves synced`);
      if (dropped > 0) toast.error(`${dropped} offline save${dropped > 1 ? 's' : ''} could not be synced`);
    };

    void flush();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flush();
    });
    return () => sub.remove();
  }, [batches, isAuthenticated, isLoading, isOffline]);

  return { isOffline, queuedCount: batches.length };
}

/** One-shot connectivity check for the save path. */
export async function isCurrentlyOffline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !state.isConnected || state.isInternetReachable === false;
  } catch {
    return false;
  }
}
