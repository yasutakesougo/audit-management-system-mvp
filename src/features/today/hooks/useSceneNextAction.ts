/**
 * useSceneNextAction — 場面ベースの NextAction を算出
 *
 * useTodaySummary のデータから場面 × 未処理状態を導出し、
 * buildSceneNextAction で次のアクションを決定する。
 *
 * ⚠ useTodaySummary は変更しない — 既存のデータ契約を再利用するのみ。
 *
 * todayRecordCompletion が提供された場合、
 * ExecutionStore 起点の記録完了状態を優先して使用する。
 * これにより /daily/support の記録が /today の NextActionCard に正しく反映される。
 *
 * @see ADR-002 guardrails
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { SupportRecordCompletionSummary } from './useSupportRecordCompletion';
import type { TriggeredException } from '@/domain/isp/exceptionBridge';
import { useMemo } from 'react';
import { buildSceneNextAction, type SceneNextAction } from '../domain/buildSceneNextAction';
import { inferTodayScene } from '../domain/inferTodayScene';
import type { TodayScene } from '../domain/todayScene';
import { sceneLabelMap } from '../domain/todayScene';
import { MandatoryTaskCategory } from '@/features/exceptions/domain/mandatoryTaskMessages';

type SceneNextActionInput = {
  /** BriefingAlerts from useTodaySummary */
  briefingAlerts: BriefingAlert[];
  /** Attendance summary from useTodaySummary */
  attendanceSummary: {
    facilityAttendees?: number;
  };
  /** Daily record status from useTodaySummary (Dashboard 起点 — fallback) */
  dailyRecordStatus: {
    pending?: number;
    pendingUserIds?: string[];
  };
  /** ExecutionStore 起点の記録完了状態 (Today-only — 優先) */
  todayRecordCompletion?: SupportRecordCompletionSummary;
  /** Users list from useTodaySummary (for alert user resolution) */
  users: { UserID?: string; FullName?: string; Id?: number }[];
  /** Scheduled users count */
  scheduledCount: number;
  /** ISP 三層モデルの整合性不備 */
  todayExceptions?: TriggeredException[];
  /** 必須業務 (Mandatory Tasks) */
  mandatoryTasks?: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category?: MandatoryTaskCategory;
    reason?: string;
  }>;
};

export type SceneNextActionViewModel = SceneNextAction & {
  sceneLabel: string;
};

export function useSceneNextAction(input: SceneNextActionInput): SceneNextActionViewModel {
  return useMemo(() => {
    const scene: TodayScene = inferTodayScene(new Date());
    const sceneLabel = sceneLabelMap[scene];

    // Pending briefings
    const pendingBriefings = input.briefingAlerts.filter(
      (a) => a.severity === 'error' || a.severity === 'warning',
    ).length;

    // Pending attendance
    const facilityAttendees = input.attendanceSummary?.facilityAttendees ?? 0;
    const pendingAttendance = Math.max(0, input.scheduledCount - facilityAttendees);

    const completion = input.todayRecordCompletion;
    const pendingDailyRecords = completion
      ? completion.pending
      : (input.dailyRecordStatus?.pending ?? 0);

    const pendingUserIds = completion
      ? completion.pendingUserIds
      : (input.dailyRecordStatus?.pendingUserIds ?? []);
    const alertUsers = pendingUserIds.slice(0, 3).map((uid) => {
      const match = input.users.find((u) => {
        const id = (u.UserID ?? '').trim() || `U${String(u.Id ?? 0).padStart(3, '0')}`;
        return id === uid;
      });
      return { id: uid, name: match?.FullName ?? uid };
    });

    const action = buildSceneNextAction({
      scene,
      pendingBriefings,
      pendingAttendance,
      pendingDailyRecords,
      alertUsers,
      pendingExceptions: input.todayExceptions,
      mandatoryTasks: input.mandatoryTasks,
    });

    return { ...action, sceneLabel };
  }, [
    input.briefingAlerts,
    input.attendanceSummary,
    input.dailyRecordStatus,
    input.todayRecordCompletion,
    input.users,
    input.scheduledCount,
    input.todayExceptions,
    input.mandatoryTasks,
  ]);
}
