/**
 * useSceneNextAction — 場面ベースの NextAction を算出
 *
 * useTodaySummary のデータから場面 × 未処理状態を導出し、
 * buildSceneNextAction で次のアクションを決定する。
 *
 * ⚠ useTodaySummary は変更しない — 既存のデータ契約を再利用するのみ。
 *
 * @see ADR-002 guardrails
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { useMemo } from 'react';
import { buildSceneNextAction, type SceneNextAction } from '../domain/buildSceneNextAction';
import { inferTodayScene } from '../domain/inferTodayScene';
import type { TodayScene } from '../domain/todayScene';
import { sceneLabelMap } from '../domain/todayScene';

type SceneNextActionInput = {
  /** BriefingAlerts from useTodaySummary */
  briefingAlerts: BriefingAlert[];
  /** Attendance summary from useTodaySummary */
  attendanceSummary: {
    facilityAttendees?: number;
  };
  /** Daily record status from useTodaySummary */
  dailyRecordStatus: {
    pending?: number;
    pendingUserIds?: string[];
  };
  /** Users list from useTodaySummary (for alert user resolution) */
  users: { UserID?: string; FullName?: string; Id?: number }[];
  /** Scheduled users count */
  scheduledCount: number;
};

export type SceneNextActionViewModel = SceneNextAction & {
  sceneLabel: string;
};

export function useSceneNextAction(input: SceneNextActionInput): SceneNextActionViewModel {
  return useMemo(() => {
    const scene: TodayScene = inferTodayScene(new Date());
    const sceneLabel = sceneLabelMap[scene];

    // Pending briefings: count error/warning severity alerts as actionable
    const pendingBriefings = input.briefingAlerts.filter(
      (a) => a.severity === 'error' || a.severity === 'warning',
    ).length;

    // Pending attendance: scheduledCount - facilityAttendees (those not yet confirmed)
    const facilityAttendees = input.attendanceSummary?.facilityAttendees ?? 0;
    const pendingAttendance = Math.max(0, input.scheduledCount - facilityAttendees);

    const pendingDailyRecords = input.dailyRecordStatus?.pending ?? 0;

    // Resolve alert users from pending user IDs
    const pendingUserIds = input.dailyRecordStatus?.pendingUserIds ?? [];
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
    });

    return { ...action, sceneLabel };
  }, [
    input.briefingAlerts,
    input.attendanceSummary,
    input.dailyRecordStatus,
    input.users,
    input.scheduledCount,
  ]);
}
