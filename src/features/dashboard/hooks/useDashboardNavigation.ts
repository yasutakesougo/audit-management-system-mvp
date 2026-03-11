/**
 * useDashboardNavigation — ルーティング・画面遷移・フィーチャーフラグ
 *
 * 依存: isMorningTime (引数で受け取る)
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlags } from '@/config/featureFlags';
import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import { useDashboardLayoutMode, type DashboardLayoutMode } from '@/features/dashboard/hooks/useDashboardLayoutMode';
import type { HandoffDayScope } from '@/features/handoff/handoffTypes';

export interface DashboardNavGroup {
  navigate: ReturnType<typeof useNavigate>;
  openTimeline: (scope?: HandoffDayScope) => void;
  openBriefing: () => void;
  layoutMode: DashboardLayoutMode;
  schedulesEnabled: boolean;
}

export function useDashboardNavigation(isMorningTime: boolean): DashboardNavGroup {
  const navigate = useNavigate();
  const layoutMode = useDashboardLayoutMode();
  const { schedules: schedulesEnabled } = useFeatureFlags();

  const openTimeline = useCallback(
    (scope: HandoffDayScope = 'today') => {
      const dateOpt = scope === 'yesterday' ? 'yesterday' : undefined;
      navigate(buildHandoffTimelineUrl({ date: dateOpt }), {
        state: { dayScope: scope, timeFilter: 'all' },
      });
    },
    [navigate],
  );

  const openBriefing = useCallback(() => {
    const tab = isMorningTime ? 'morning' : 'evening';
    navigate('/dashboard/briefing', { state: { tab } });
  }, [navigate, isMorningTime]);

  return {
    navigate,
    openTimeline,
    openBriefing,
    layoutMode,
    schedulesEnabled,
  };
}
