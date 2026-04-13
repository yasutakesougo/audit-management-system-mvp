import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { IspRepository } from '@/domain/isp/port';
import type { IndividualSupportPlan } from '@/domain/isp/schema';
import { toExportModel } from '../utils/exportTransformers';
import { validateExportContract } from '../utils/exportValidation';
import { buildSupportPlanTimeline } from '../domain/timeline';
import { buildSupportPlanGuidance } from '../domain/guidanceEngine';
import { buildGuidanceNarrative, SupportPlanNarrative } from '../domain/narrativeEngine';
import { buildActionSuggestionsFromSupportPlan } from '../domain/actionBridge';
import { ActionSuggestion, useActionTaskStore } from '@/features/action-engine';
import type { SupportPlanDraft, SupportPlanForm } from '../types';
import type { ExportValidationResult } from '../types/export';
import type { SupportPlanGuidance } from '../domain/guidanceEngine';
import type { SupportPlanTimeline, SupportPlanTimelineSummary } from '../domain/timeline.types';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';

interface UseSupportPlanTimelineOptions {
  userId: string | null;
  currentDraftData: SupportPlanForm;
  ispRepo: IspRepository;
  icebergItems?: IcebergPdcaItem[];
}

interface UseSupportPlanTimelineReturn {
  timeline: SupportPlanTimeline['entries'];
  summary: SupportPlanTimelineSummary;
  guidance: SupportPlanGuidance;
  narrative: SupportPlanNarrative | null;
  actions: ActionSuggestion[];
  isLoading: boolean;
}

const EMPTY_VALIDATION: ExportValidationResult = {
  isExportable: true,
  issues: [],
  passCount: 0,
  warnCount: 0,
  blockCount: 0,
  ibdIncluded: false,
};

function buildDraftFromForm(form: SupportPlanForm, userId: string | null): SupportPlanDraft {
  return {
    id: `current-${userId ?? 'unknown'}`,
    name: form.serviceUserName || 'current-draft',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
    data: form,
    userId,
  };
}

function buildDraftFromHistoricalPlan(plan: IndividualSupportPlan): SupportPlanDraft {
  const supportLevel = plan.userSnapshot?.disabilitySupportLevel ?? '';
  const draftData: SupportPlanForm = {
    serviceUserName: plan.title ?? '',
    supportLevel,
    planPeriod: [plan.planStartDate, plan.planEndDate].filter(Boolean).join(' 〜 '),
    assessmentSummary: [plan.userIntent, plan.familyIntent].filter(Boolean).join('\n'),
    strengths: '',
    decisionSupport: plan.overallSupportPolicy ?? '',
    conferenceNotes: '',
    monitoringPlan: plan.monitoringSummary ?? '',
    reviewTiming: plan.nextReviewAt ?? '',
    riskManagement: plan.precautions ?? '',
    complianceControls: '',
    improvementIdeas: '',
    lastMonitoringDate: plan.lastMonitoringAt ?? '',
    medicalConsiderations: '',
    emergencyResponsePlan: '',
    rightsAdvocacy: '',
    serviceStartDate: plan.planStartDate ?? '',
    firstServiceDate: plan.planStartDate ?? '',
    attendingDays: '',
    userRole: '',
    ibdEnvAdjustment: '',
    ibdPbsStrategy: '',
    goals: [
      ...plan.longTermGoals.map((text, index) => ({
        id: `hist-long-${index}`,
        text,
        label: `長期目標${index + 1}`,
        type: 'long' as const,
        domains: [],
      })),
      ...plan.shortTermGoals.map((text, index) => ({
        id: `hist-short-${index}`,
        text,
        label: `短期目標${index + 1}`,
        type: 'short' as const,
        domains: [],
      })),
    ],
  };

  return {
    id: plan.id,
    name: plan.title ?? 'historical-plan',
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    data: draftData,
    userId: String(plan.userId),
  };
}

/**
 * 支援計画の時系列分析とガイダンスを提供するフック
 */
export const useSupportPlanTimeline = ({
  userId,
  currentDraftData,
  ispRepo,
  icebergItems = []
}: UseSupportPlanTimelineOptions): UseSupportPlanTimelineReturn => {
  const { tasks } = useActionTaskStore();

  // 1. 過去の ISP 一覧（フル）を取得
  const { data: historicalPlans = [], isLoading } = useQuery({
    queryKey: ['isp-timeline', userId],
    queryFn: async () => {
      if (!userId) return [];
      return ispRepo.listFullByUser(userId);
    },
    enabled: !!userId,
  });

  // 2. 時系列のスナップショット群を構築
  const result = useMemo(() => {
    const pastSnapshots = historicalPlans.map((plan) => {
      const draft = buildDraftFromHistoricalPlan(plan);
      return toExportModel(draft, validateExportContract(draft.data));
    });

    const currentDraft = buildDraftFromForm(currentDraftData, userId);
    const currentSnapshot = toExportModel(currentDraft, validateExportContract(currentDraftData) ?? EMPTY_VALIDATION);
    const allSnapshots = [...pastSnapshots, currentSnapshot];

    const timeline = buildSupportPlanTimeline(allSnapshots);
    const summary = timeline.summary;
    const guidance = buildSupportPlanGuidance(summary);

    const latestEntry = timeline.entries[timeline.entries.length - 1];
    const currentDiff = latestEntry?.diffFromPrevious ?? null;

    const narrative = buildGuidanceNarrative(summary, guidance, currentDiff, icebergItems);

    const actions = buildActionSuggestionsFromSupportPlan(
      userId || 'unknown-user',
      summary,
      guidance,
      currentSnapshot
    );

    const completedTasks = Object.values(tasks).filter(
      (t) => t.status === 'done' && t.targetUserId === (userId || 'unknown-user')
    );

    return {
      timeline: timeline.entries,
      summary: {
        ...summary,
        completedTasks,
      },
      guidance,
      narrative,
      actions,
    };
  }, [historicalPlans, currentDraftData, userId, icebergItems, tasks]);

  return {
    ...result,
    isLoading,
  };
};
