import axios from 'axios';
import type { ImportJobPhase } from './importDashboard';

export type ImportJobStatusPayload = {
  status: string;
  phase?: string;
  message?: string;
  progress?: number;
  error?: string;
};

export type ImportJobPollOutcome =
  | { type: 'active'; phase?: ImportJobPhase; message?: string; progress?: number }
  | { type: 'completed'; message?: string }
  | { type: 'cancelled'; message?: string }
  | { type: 'failed'; message?: string }
  | { type: 'gone' };

export function isImportJobGoneError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function outcomeFromImportJobStatus(data: ImportJobStatusPayload): ImportJobPollOutcome {
  if (data.status === 'completed') {
    return { type: 'completed', message: data.message };
  }
  if (data.status === 'cancelled') {
    return { type: 'cancelled', message: data.message };
  }
  if (data.status === 'failed') {
    return { type: 'failed', message: data.message || data.error };
  }
  return {
    type: 'active',
    phase: data.phase as ImportJobPhase | undefined,
    message: data.message,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
  };
}
