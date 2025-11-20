/**
 * Phase 5B: MeetingGuidePage ↔ MeetingGuideDrawer連携
 *
 * 単一情報源となる統合フック
 * MeetingGuidePageとMeetingGuideDrawerが同じセッションデータを共有
 */

import { useCallback, useMemo } from 'react';
import { useHandoffSummary } from '../handoff/useHandoffSummary';
import { meetingLogger } from './logging/meetingLogger';
import type { MeetingKind } from './meetingSteps';
import { mergeStepRecordsWithTemplates, useMeetingSteps } from './meetingSteps';
import { useMeetingSession } from './useMeetingData';
import { usePriorityFollowUsers } from './usePriorityFollowUsers';

/**
 * 今日のセッションキーを生成
 */
function buildSessionKeyForToday(kind: MeetingKind): string {
  const today = new Date().toISOString().split('T')[0];
  return `${today}_${kind}`;
}

/**
 * 現在の朝会・夕会セッションの統合管理フック
 *
 * MeetingGuidePageとMeetingGuideDrawerで共有する単一情報源
 *
 * @param kind - 'morning' | 'evening'
 * @returns 統合された会議セッション情報
 */
export function useCurrentMeeting(kind: MeetingKind) {
  const sessionKey = buildSessionKeyForToday(kind);

  // SharePoint統合セッション
  const {
    session,
    stepRecords,
    loading: sessionLoading,
    error: sessionError,
    upsertStepRecord,
  } = useMeetingSession(sessionKey, kind);

  // ローカル状態管理（UI用）
  const stepsHook = useMeetingSteps(kind);

  // 重点フォローユーザー
  const priorityUsers = usePriorityFollowUsers();

  // Option B: 申し送りアラート統合
  const dayScope = kind === 'morning' ? 'yesterday' : 'today';
  const { criticalCount, byStatus } = useHandoffSummary({ dayScope });

  // 未完了の重要案件数（重要 × (未対応 or 対応中)）
  const activeCriticalCount = criticalCount;
  const totalActiveCount = byStatus['未対応'] + byStatus['対応中'];

  // SharePointからの状態をローカル状態にマージ
  const mergedSteps = useMemo(() => {
    if (!stepRecords || stepRecords.length === 0) {
      return stepsHook.steps;
    }

    return mergeStepRecordsWithTemplates(
      kind,
      stepRecords.map(r => ({
        stepId: r.stepId,
        completed: r.completed,
      }))
    );
  }, [kind, stepRecords, stepsHook.steps]);

  // 統合ステップトグル処理
  const toggleStep = useCallback(async (stepId: number) => {
    const step = mergedSteps.find(s => s.id === stepId);
    const newCompleted = step ? !step.completed : true;
    const stepTitle = step ? step.title : `Step ${stepId}`;

    // ① ローカル状態更新（楽観的UI）
    stepsHook.toggleStep(stepId);

    // ② SharePoint永続化（meetingLoggerはuseMeetingSessionで呼び出し済み）
    try {
      await upsertStepRecord({
        stepId: stepId.toString(),
        completed: newCompleted,
      });

      // ③ 追加ログ（統合フック経由での操作記録）
      meetingLogger.stepToggled({
        sessionKey,
        kind,
        stepId: stepId.toString(),
        stepTitle,
        completed: newCompleted,
        userId: 'currentUser', // TODO: 実際のユーザーIDを取得
      });
    } catch (error) {
      console.error('Failed to sync step with SharePoint:', error);
      // エラー時はUI状態を元に戻す
      stepsHook.toggleStep(stepId);
      throw error;
    }
  }, [mergedSteps, stepsHook, upsertStepRecord, sessionKey, kind]);

  // 進行状況統計
  const stats = useMemo(() => {
    const totalCount = mergedSteps.length;
    const completedCount = mergedSteps.filter(s => s.completed).length;
    const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      completedCount,
      progressPercentage,
    };
  }, [mergedSteps]);

  return {
    // セッション情報
    sessionKey,
    kind,
    session,

    // ステップ情報
    steps: mergedSteps,
    stats,
    toggleStep,

    // 重点フォロー情報
    priorityUsers,

    // Option B: 申し送りアラート情報
    handoffAlert: {
      criticalCount: activeCriticalCount,
      totalActiveCount,
      hasAlerts: activeCriticalCount > 0 || totalActiveCount > 0,
    },

    // 状態
    loading: sessionLoading,
    error: sessionError,
  };
}