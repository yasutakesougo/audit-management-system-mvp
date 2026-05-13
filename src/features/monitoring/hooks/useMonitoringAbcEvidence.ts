import React from 'react';
import { useUser } from '@/features/users/useUsers';
import { resolveSupportStartDateDetailed } from '@/features/planning-sheet/monitoringSchedule';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { SharePointAbcRecordRepository } from '@/infra/sharepoint/repos/SharePointAbcRecordRepository';
import type { AbcRecord } from '@/domain/abc/abcRecord';

export interface UseMonitoringAbcEvidenceResult {
  records: AbcRecord[];
  loading: boolean;
  error: Error | null;
  period: {
    from: string;
    to: string;
    isProvisional: boolean;
    source: 'planning' | 'master' | 'fallback' | 'none';
  } | null;
}

/**
 * 評価期間内の AbcBehaviorRecords を取得するカスタムフック
 */
export function useMonitoringAbcEvidence(
  userId: string | null | undefined,
  supportStartDate: string | null | undefined,
  monitoringCycleDays: number = 90,
  appliedFrom?: string | null | undefined,
): UseMonitoringAbcEvidenceResult {
  const [records, setRecords] = React.useState<AbcRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const { data: userMaster, status: userStatus } = useUser(userId ?? undefined);
  const { provider } = useDataProvider();
  
  const repository = React.useMemo(() => {
    return provider ? new SharePointAbcRecordRepository(provider) : null;
  }, [provider]);

  const resolvedBase = React.useMemo(() => {
    return resolveSupportStartDateDetailed(
      supportStartDate,
      userMaster?.ServiceStartDate,
      appliedFrom,
    );
  }, [supportStartDate, userMaster?.ServiceStartDate, appliedFrom]);

  // 評価期間の計算
  const period = React.useMemo(() => {
    if (!resolvedBase.date) return null;
    const fromDate = new Date(resolvedBase.date);
    if (isNaN(fromDate.getTime())) return null;

    const days = monitoringCycleDays || 90;
    // ミリ秒加算
    const toDate = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
    if (isNaN(toDate.getTime())) return null;

    return {
      from: resolvedBase.date,
      to: toDate.toISOString().slice(0, 10),
      isProvisional: resolvedBase.source === 'fallback',
      source: resolvedBase.source,
    };
  }, [resolvedBase, monitoringCycleDays]);

  React.useEffect(() => {
    if (!userId || !repository || !period) {
      setRecords([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    repository
      .findByUserIdAndDateRange({
        userId,
        from: period.from,
        to: period.to,
      })
      .then((data) => {
        if (!isMounted) return;
        setRecords(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, repository, period?.from, period?.to]);

  const isActuallyLoading = loading || (!!userId && userStatus === 'loading');

  return {
    records,
    loading: isActuallyLoading,
    error,
    period,
  };
}
