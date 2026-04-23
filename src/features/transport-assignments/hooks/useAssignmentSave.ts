import { useCallback, useState } from 'react';
import { AssignmentRepository, TransportAssignment } from '@/features/schedules/domain/assignment';
import { TransportAssignmentDraft } from '../domain/transportAssignmentDraft';
import { orchestrateAssignmentSave } from '../application/transportAssignmentApplication';

export type AssignmentSaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type AssignmentSaveResult = {
  success: boolean;
  error?: unknown;
};

/**
 * Modern hook for saving assignments via the repository.
 */
export function useAssignmentSave(repository: AssignmentRepository) {
  const [status, setStatus] = useState<AssignmentSaveStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  const saveAssignments = useCallback(
    async (draft: TransportAssignmentDraft): Promise<AssignmentSaveResult> => {
      setStatus('saving');
      setError(null);

      try {
        await orchestrateAssignmentSave(repository, draft);
        setStatus('success');
        return { success: true };
      } catch (err) {
        setError(err);
        setStatus('error');
        return { success: false, error: err };
      }
    },
    [repository],
  );

  const saveBulkAssignments = useCallback(
    async (assignments: TransportAssignment[]): Promise<AssignmentSaveResult> => {
      setStatus('saving');
      setError(null);

      try {
        await repository.saveBulk(assignments);
        setStatus('success');
        return { success: true };
      } catch (err) {
        setError(err);
        setStatus('error');
        return { success: false, error: err };
      }
    },
    [repository],
  );

  const clearError = useCallback(() => {
    setError(null);
    if (status === 'error') {
      setStatus('idle');
    }
  }, [status]);

  return {
    status,
    error,
    saveAssignments,
    saveBulkAssignments,
    clearError,
  };
}
