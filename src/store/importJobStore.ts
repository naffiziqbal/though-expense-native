import { create } from 'zustand';
import type { ImportJobPhase } from '../lib/importDashboard';

type ImportJobState = {
  jobId: string | null;
  fileName: string | null;
  phase: ImportJobPhase;
  message: string;
  progress: number;
  startJob: (jobId: string, fileName: string, message: string) => void;
  patchJob: (patch: Partial<Pick<ImportJobState, 'phase' | 'message' | 'progress'>>) => void;
  clearJob: () => void;
};

export const useImportJobStore = create<ImportJobState>((set) => ({
  jobId: null,
  fileName: null,
  phase: 'queued',
  message: '',
  progress: 0,
  startJob: (jobId, fileName, message) =>
    set({ jobId, fileName, phase: 'queued', message, progress: 0 }),
  patchJob: (patch) => set(patch),
  clearJob: () =>
    set({ jobId: null, fileName: null, phase: 'queued', message: '', progress: 0 }),
}));
