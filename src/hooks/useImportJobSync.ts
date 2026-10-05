import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { isImportJobGoneError, outcomeFromImportJobStatus } from '../lib/importJobLifecycle';
import { toast } from '../store/toastStore';
import { useImportJobStore } from '../store/importJobStore';
import { useAuthStore } from '../store/authStore';

/** Polls active document-import jobs until complete (works when Profile sheet is closed). */
export function useImportJobSync() {
  const router = useRouter();
  const jobId = useImportJobStore((s) => s.jobId);
  const patchJob = useImportJobStore((s) => s.patchJob);
  const clearJob = useImportJobStore((s) => s.clearJob);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ticking = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !jobId) return;

    const poll = async () => {
      if (ticking.current) return;
      ticking.current = true;
      try {
        const res = await api.getParseJobStatus(jobId);
        const outcome = outcomeFromImportJobStatus(res.data);
        if (outcome.type === 'active') {
          patchJob({
            message: outcome.message,
            progress: outcome.progress,
            phase: outcome.phase,
          });
          return;
        }
        if (outcome.type === 'completed') {
          toast.success(outcome.message || 'Import complete');
          clearJob();
          router.push('/(tabs)/expenses');
          return;
        }
        if (outcome.type === 'cancelled') {
          clearJob();
          return;
        }
        if (outcome.type === 'failed') {
          toast.error(outcome.message || 'Import failed');
          clearJob();
          return;
        }
      } catch (err: unknown) {
        if (isImportJobGoneError(err)) {
          clearJob();
          return;
        }
        patchJob({ message: 'Still working…' });
      } finally {
        ticking.current = false;
      }
    };

    poll();
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [jobId, isAuthenticated, patchJob, clearJob, router]);
}
