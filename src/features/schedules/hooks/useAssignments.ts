import { useCallback, useEffect, useState } from 'react';
import { useAssignmentRepository } from '../assignmentRepositoryFactory';
import type { Assignment, AssignmentListFilter } from '../domain/assignment';

/**
 * useAssignments Hook
 * 
 * Fetches and manages Assignment domain models using the AssignmentRepository.
 */
export function useAssignments(filter: AssignmentListFilter) {
  const repository = useAssignmentRepository();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(async () => {
    if (!filter.range) return;

    try {
      setLoading(true);
      setError(null);
      
      const items = await repository.list(filter);
      setAssignments(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [repository, JSON.stringify(filter)]);

  useEffect(() => {
    void reload();
  }, [reload, reloadToken]);

  const refetch = () => setReloadToken(v => v + 1);

  return {
    assignments,
    loading,
    error,
    refetch,
    isLoading: loading,
  };
}
