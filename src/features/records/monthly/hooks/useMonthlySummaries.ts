import { useState, useCallback, useEffect } from 'react';
import { useUsers } from '@/features/users/useUsers';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { isDemoModeEnabled } from '@/lib/env';
import { mockMonthlySummaries } from '../monthlyRecordSeedData';
import { executeKioskMonthlyAggregation } from '../kioskMonthlyAggregationUseCase';
import type { MonthlySummary, YearMonth } from '../types';

/**
 * Hook to fetch and aggregate monthly summaries for all active users.
 * Supports both demo (mock) and production (SharePoint) data sources.
 */
export function useMonthlySummaries(yearMonth: YearMonth) {
  const { users, isLoading: loadingUsers } = useUsers();
  const repository = useExecutionData();
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // 1. Handle Demo Mode
    if (isDemoModeEnabled()) {
      // Filter mocks by yearMonth if needed, but for now we just return them
      // as they are primarily for UI demonstration.
      setSummaries(mockMonthlySummaries);
      setLoading(false);
      return;
    }

    // 2. Handle Production Mode (requires repository and users)
    if (loadingUsers) return;
    
    if (!repository) {
      setError('Repository not initialized');
      setLoading(false);
      return;
    }

    if (users.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Aggregate data for each user in parallel
      const results = await Promise.all(
        users.map((user) =>
          executeKioskMonthlyAggregation(repository, {
            userId: user.UserID,
            displayName: user.FullName,
            yearMonth,
          })
        )
      );
      
      setSummaries(results.map((r) => r.summary));
      setError(null);
    } catch (err) {
      console.error('[useMonthlySummaries] Aggregation failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repository, users, yearMonth, loadingUsers]);

  // Initial load and re-fetch when month changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    summaries,
    loading: loading || loadingUsers,
    error,
    refresh,
    isDemo: isDemoModeEnabled()
  };
}
