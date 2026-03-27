/**
 * useDailyRecordContextData — ContextPanel 用の派生データを構築するカスタム hook
 *
 * DailyRecordPage から切り出した contextData useMemo ロジック。
 * editingRecord に対応するユーザーの handoff / recentRecords / alerts / prompts を算出する。
 */

import { useMemo } from 'react';
import {
  buildContextAlerts,
  buildContextSummary,
  buildRecommendedPrompts,
  createEmptyContextData,
  prioritizeContextAlerts,
  type ContextPanelData,
  type ContextHandoff,
} from '@/features/context/domain/contextPanelLogic';
import type { PersonDaily } from '@/domain/daily/types';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';

interface EditingRecord {
  userId: string;
  userName: string;
}

interface UserWithFlags {
  Id: number;
  UserID: string;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;
}

interface UseDailyRecordContextDataParams {
  editingRecord: EditingRecord | null;
  records: PersonDaily[];
  usersData: UserWithFlags[] | undefined;
  handoffRecordsForContext: HandoffRecord[];
}

interface UseDailyRecordContextDataResult {
  contextData: ContextPanelData;
  contextUserName: string;
}

/**
 * ContextPanel 用データを算出する。
 *
 * @param params editingRecord / records / usersData / handoffRecordsForContext
 * @returns contextData と contextUserName
 */
export function useDailyRecordContextData({
  editingRecord,
  records,
  usersData,
  handoffRecordsForContext,
}: UseDailyRecordContextDataParams): UseDailyRecordContextDataResult {
  const contextData: ContextPanelData = useMemo(() => {
    if (!editingRecord) return createEmptyContextData();
    const user = usersData?.find(
      (u) => u.UserID === editingRecord.userId || String(u.Id) === editingRecord.userId,
    );

    const isHighIntensity = user?.IsHighIntensitySupportTarget ?? false;
    const isSupportProcedureTarget = user?.IsSupportProcedureTarget ?? false;

    // Sprint-1 Phase C: 実データ連携 — supportPlan は Phase 3 (ISP接続)
    const supportPlan = { status: 'none' as const, planPeriod: '', goals: [] };
    // handoffs は handoffRecordsForContext から editingRecord のユーザーでフィルタ
    const handoffs: ContextHandoff[] = handoffRecordsForContext
      .filter(
        (h) =>
          h.userCode === editingRecord.userId ||
          h.userDisplayName === editingRecord.userName,
      )
      .map((h) => ({
        id: String(h.id),
        message: h.message ?? '',
        category: h.category ?? '',
        severity: h.severity ?? '',
        status: h.status ?? '',
        createdAt: h.createdAt ?? '',
      }));

    const recentRecordsBase = records
      .filter((r) => r.userId === editingRecord.userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const alerts = buildContextAlerts({
      supportPlan,
      handoffs,
      recentRecords: recentRecordsBase
        .filter((r) => r.status === '完了')
        .map((r) => ({ date: r.date, status: r.status })),
      isHighIntensity,
      isSupportProcedureTarget,
    });

    const recentRecordsForDisplay = recentRecordsBase.map((r) => ({
      date: r.date,
      status: r.status,
      specialNotes: r.kind === 'A' ? r.data.specialNotes : undefined,
    }));

    return {
      supportPlan,
      handoffs,
      recentRecords: recentRecordsForDisplay,
      alerts: prioritizeContextAlerts(alerts),
      summary: buildContextSummary(recentRecordsForDisplay, handoffs),
      prompts: buildRecommendedPrompts(supportPlan, isHighIntensity, isSupportProcedureTarget),
    };
  }, [editingRecord, records, usersData, handoffRecordsForContext]);

  const contextUserName = editingRecord?.userName ?? '';

  return { contextData, contextUserName };
}
