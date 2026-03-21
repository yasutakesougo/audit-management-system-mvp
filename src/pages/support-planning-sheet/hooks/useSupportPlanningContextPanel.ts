import React from 'react';
import {
  buildContextAlerts,
  buildContextSummary,
  buildRecommendedPrompts,
  createEmptyContextData,
  prioritizeContextAlerts,
  type ContextHandoff,
  type ContextPanelData,
} from '@/features/context/domain/contextPanelLogic';
import type { HandoffDayScope, HandoffRecord, HandoffTimeFilter } from '@/features/handoff/handoffTypes';

type ContextTargetUser = {
  FullName?: string;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;
} | null | undefined;

type HandoffRepository = {
  getRecords: (dayScope: HandoffDayScope, timeFilter: HandoffTimeFilter) => Promise<HandoffRecord[]>;
};

type UseSupportPlanningContextPanelParams = {
  userId: string | undefined;
  targetUser: ContextTargetUser;
  handoffRepo: HandoffRepository;
};

type UseSupportPlanningContextPanelResult = {
  contextData: ContextPanelData;
  contextUserName: string;
};

export function useSupportPlanningContextPanel({
  userId,
  targetUser,
  handoffRepo,
}: UseSupportPlanningContextPanelParams): UseSupportPlanningContextPanelResult {
  const [handoffRecordsForContext, setHandoffRecordsForContext] = React.useState<HandoffRecord[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const records = await handoffRepo.getRecords('today', 'all');
        if (!cancelled) setHandoffRecordsForContext(records);
      } catch {
        if (!cancelled) setHandoffRecordsForContext([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [handoffRepo]);

  const contextData: ContextPanelData = React.useMemo(() => {
    if (!userId) return createEmptyContextData();
    const isHighIntensity = targetUser?.IsHighIntensitySupportTarget ?? false;
    const isSupportProcedureTarget = targetUser?.IsSupportProcedureTarget ?? false;

    const supportPlan = {
      status: 'confirmed' as const,
      planPeriod: '',
      goals: [] as Array<{ type: 'long' | 'short' | 'support'; label: string; text: string }>,
    };

    const handoffs: ContextHandoff[] = handoffRecordsForContext
      .filter((record) => record.userCode === userId || record.userDisplayName === (targetUser?.FullName ?? ''))
      .map((record) => ({
        id: String(record.id),
        message: record.message ?? '',
        category: record.category ?? '',
        severity: record.severity ?? '',
        status: record.status ?? '',
        createdAt: record.createdAt ?? '',
      }));

    const alerts = buildContextAlerts({
      supportPlan,
      handoffs,
      recentRecords: [],
      isHighIntensity,
      isSupportProcedureTarget,
    });

    return {
      supportPlan,
      handoffs,
      recentRecords: [],
      alerts: prioritizeContextAlerts(alerts),
      summary: buildContextSummary([], handoffs),
      prompts: buildRecommendedPrompts(supportPlan, isHighIntensity, isSupportProcedureTarget),
    };
  }, [handoffRecordsForContext, targetUser, userId]);

  return {
    contextData,
    contextUserName: targetUser?.FullName ?? userId ?? '',
  };
}
