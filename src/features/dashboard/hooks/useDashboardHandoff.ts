/**
 * useDashboardHandoff — 申し送りの集計 + タイムラインデータ
 *
 * 自己完結型。外部依存なし。
 */

import type { HandoffDayScope, HandoffRecord, HandoffStatus } from '@/features/handoff/handoffTypes';
import { useHandoffSummary } from '@/features/handoff/useHandoffSummary';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';

export interface DashboardHandoffGroup {
  total: number;
  critical: number;
  status: Record<string, number>;
  timeline: {
    items: HandoffRecord[];
    loading: boolean;
    error: string | null;
    updateStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
    reload: () => void;
  };
}

export function useDashboardHandoff(dayScope: HandoffDayScope = 'today'): DashboardHandoffGroup {
  const {
    total,
    byStatus: status,
    criticalCount: critical,
  } = useHandoffSummary({ dayScope });

  const {
    todayHandoffs: items,
    loading,
    error,
    updateHandoffStatus: updateStatus,
    reload,
  } = useHandoffTimeline('all', dayScope);

  return {
    total,
    critical,
    status,
    timeline: { items, loading, error, updateStatus, reload },
  };
}
