import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { IspRepository } from '@/domain/isp/port';
import { toExportModel } from '../utils/exportTransformers';
import { buildSupportPlanTimeline, summarizeSupportPlanTimeline, SupportPlanTimelineSummary, SupportPlanGuidance } from '../domain/timeline';
import { generateSupportPlanGuidance } from '../domain/guidanceEngine';
import { buildGuidanceNarrative, SupportPlanNarrative } from '../domain/narrativeEngine';
import { buildActionSuggestionsFromSupportPlan } from '../domain/actionBridge';
import { ActionSuggestion, useActionTaskStore } from '@/features/action-engine';
import type { SupportPlanDraftData } from '../types';
import type { IcebergPdcaItem } from '../../ibd/analysis/pdca/types';

interface UseSupportPlanTimelineOptions {
  userId: string | null;
  currentDraftData: SupportPlanDraftData;
  ispRepo: IspRepository;
  icebergItems?: IcebergPdcaItem[];
}

interface UseSupportPlanTimelineReturn {
  timeline: any[];
  summary: SupportPlanTimelineSummary;
  guidance: SupportPlanGuidance;
  narrative: SupportPlanNarrative | null;
  actions: ActionSuggestion[];
  isLoading: boolean;
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
    // 過去分を ExportModel に変換
    const pastSnapshots = historicalPlans.map((plan) => {
      // plan (IndividualSupportPlan) を SupportPlanDraftData 相当に変換して toExportModel に渡す
      // ここでは IndividualSupportPlan -> ExportModel の直接変換があればベターだが、
      // 既存の toExportModel が SupportPlanDraftData を前提にしているため、最小限の変換を行う
      
      // TODO: 必要に応じて IndividualSupportPlan から ExportModel への専用トランスフォーマーを作成する
      // 現在の実装では toExportModel(rawDraft) が SSOT なので、一旦それに合わせる
      // (IndividualSupportPlan の構造は SupportPlanDraftData とほぼ重なっている)
      
      const draftLikeData: any = {
        serviceUserName: plan.title, // 一旦 title を使用
        supportLevel: plan.userSnapshot?.supportLevel ?? '',
        planPeriod: `${plan.planStartDate} 〜 ${plan.planEndDate}`,
        assessmentSummary: plan.userIntent + '\n' + plan.familyIntent,
        strengths: '', // 個別計画には直接ない場合がある
        decisionSupport: '',
        monitoringPlan: plan.monitoringSummary,
        riskManagement: plan.precautions,
        goals: [
          ...plan.longTermGoals.map((g, i) => ({ id: `l-${i}`, text: g, label: `長期目標${i+1}`, type: 'long', domains: [] })),
          ...plan.shortTermGoals.map((g, i) => ({ id: `s-${i}`, text: g, label: `短期目標${i+1}`, type: 'short', domains: [] })),
        ],
        meta: {
          exportedAt: plan.updatedAt, // 最終更新日をエクスポート日と見なす
        }
      };
      
      return toExportModel(draftLikeData);
    });

    // 現在のドラフトを ExportModel に変換して末尾に追加
    const currentSnapshot = toExportModel(currentDraftData);
    const allSnapshots = [...pastSnapshots, currentSnapshot];

    // タイムライン構築
    const timeline = buildSupportPlanTimeline(allSnapshots);
    const summary = summarizeSupportPlanTimeline(timeline);
    const guidance = generateSupportPlanGuidance(summary);

    // 最新の差分を取得（現在のドラフトと一つ前のスナップショット）
    const latestEntry = timeline[timeline.length - 1];
    const currentDiff = latestEntry?.diffFromPrevious ?? null;

    // ナラティブ生成
    const narrative = buildGuidanceNarrative(summary, guidance, currentDiff, icebergItems);

    // 行動提案の生成 (Action Engine 連携)
    const actions = buildActionSuggestionsFromSupportPlan(
      userId || 'unknown-user',
      summary,
      guidance,
      currentSnapshot
    );

    // 完了済みタスクをサマリーに含める
    const completedTasks = Object.values(tasks).filter(
      (t) => t.status === 'done' && t.victimId === (userId || 'unknown-user')
    );

    return {
      timeline,
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
}
