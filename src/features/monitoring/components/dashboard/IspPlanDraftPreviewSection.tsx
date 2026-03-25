import React, { useMemo } from 'react';
import Divider from '@mui/material/Divider';
import type { DailyMonitoringSummary } from '../../domain/monitoringDailyAnalytics';
import type { IspRecommendationDecision } from '../../domain/ispRecommendationDecisionTypes';
import type { SupportPlanStringFieldKey } from '@/features/support-plan-guide/types';
import { buildDecisionSummary } from '../../domain/ispRecommendationDecisionUtils';
import { buildIspPlanDraft } from '../../domain/ispPlanDraftUtils';
import type { BuildIspPlanDraftInput } from '../../domain/ispPlanDraftTypes';
import IspPlanDraftPreview from '../IspPlanDraftPreview';

export const IspPlanDraftPreviewSection: React.FC<{
  summary: DailyMonitoringSummary;
  insightLines: string[];
  decisions: IspRecommendationDecision[];
  goalNames?: Record<string, string>;
  onAppendInsight: (text: string) => void;
  onSaveDraft?: () => void;
  isSavingDraft?: boolean;
  hasSavedDraft?: boolean;
  onApplyToEditor?: (fieldKey: SupportPlanStringFieldKey, text: string) => void;
}> = ({ summary, insightLines, decisions, goalNames, onAppendInsight, onSaveDraft, isSavingDraft, hasSavedDraft, onApplyToEditor }) => {
  const draft = useMemo(() => {
    const recs = summary.ispRecommendations ?? {
      recommendations: [],
      overallLevel: 'pending' as const,
      actionableCount: 0,
      totalGoalCount: summary.goalProgress?.length ?? 0,
      summaryText: '',
    };
    const decisionSummary = buildDecisionSummary(recs, decisions);

    const input: BuildIspPlanDraftInput = {
      periodSummary: {
        from: summary.period.from,
        to: summary.period.to,
        recordedDays: summary.period.recordedDays,
        totalDays: summary.period.totalDays,
        recordRate: summary.period.recordRate,
      },
      monitoringFindings: insightLines.length > 0 ? insightLines : undefined,
      goalProgress: summary.goalProgress,
      ispRecommendations: summary.ispRecommendations ?? undefined,
      decisions,
      decisionSummary,
      goalNames,
    };

    return buildIspPlanDraft(input);
  }, [summary, insightLines, decisions, goalNames]);

  return (
    <>
      <IspPlanDraftPreview
        draft={draft}
        onAppendToEvaluation={onAppendInsight}
        onSaveDraft={onSaveDraft}
        isSavingDraft={isSavingDraft}
        hasSavedDraft={hasSavedDraft}
        onApplyToEditor={onApplyToEditor}
      />
      <Divider />
    </>
  );
};
