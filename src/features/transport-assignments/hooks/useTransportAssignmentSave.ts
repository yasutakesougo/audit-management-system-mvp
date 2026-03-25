import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import { useCallback, useState } from 'react';

export type TransportAssignmentSaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type UseTransportAssignmentSaveOptions = {
  updateSchedule: (input: UpdateScheduleEventInput) => Promise<void>;
  refetchSchedules: () => void | Promise<void>;
};

export type TransportAssignmentSaveResult = {
  success: boolean;
  updatedCount: number;
  error?: unknown;
};

export function useTransportAssignmentSave(options: UseTransportAssignmentSaveOptions) {
  const [status, setStatus] = useState<TransportAssignmentSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const clearError = useCallback(() => {
    setError(null);
    if (status === 'error') {
      setStatus('idle');
    }
  }, [status]);

  const save = useCallback(
    async (payloads: readonly UpdateScheduleEventInput[]): Promise<TransportAssignmentSaveResult> => {
      if (payloads.length === 0) {
        return { success: true, updatedCount: 0 };
      }

      setStatus('saving');
      setError(null);

      try {
        for (const payload of payloads) {
          await options.updateSchedule(payload);
        }
        await options.refetchSchedules();
        const now = new Date().toISOString();
        setLastSavedAt(now);
        setStatus('success');
        return { success: true, updatedCount: payloads.length };
      } catch (err) {
        setError(err);
        setStatus('error');
        return { success: false, updatedCount: 0, error: err };
      }
    },
    [options],
  );

  return {
    status,
    lastSavedAt,
    error,
    clearError,
    save,
  };
}
