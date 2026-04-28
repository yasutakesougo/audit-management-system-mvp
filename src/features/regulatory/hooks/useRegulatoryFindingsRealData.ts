/**
 * useRegulatoryFindingsRealData — 通常 finding の実データ収集 hook
 *
 * SP のマスタ系データを収集し、`buildRegulatoryFindings` に渡す
 * `AuditCheckInput[]` を構築する。
 *
 * アーキテクチャは `useSevereAddonRealData` と同一パターン:
 *   1. useUsers() / useStaff() で利用者・職員を取得
 *   2. PlanningSheetRepository で現行シートを取得
 *   3. ProcedureRecordRepository で手順記録を取得
 *   4. 純粋関数 (auditCheckInputBuilder) で入力を組み立て
 *   5. buildRegulatoryFindings で finding を生成
 *   6. 取得不能時はデモデータにフォールバック
 *
 * @see auditCheckInputBuilder.ts — 変換純粋関数群
 * @see auditChecks.ts — buildRegulatoryFindings
 */

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { AuditFinding, AuditCheckInput } from '@/domain/regulatory/auditChecks';
import type { PlanningSheetListItem, ProcedureRecordListItem } from '@/domain/isp/schema';
import type { PlanningSheetRepository, ProcedureRecordRepository } from '@/domain/isp/port';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import {
  buildRegulatoryFindings,
  _resetFindingCounter,
} from '@/domain/regulatory/auditChecks';
import {
  buildAllAuditCheckInputs,
  type RecordMinimal,
} from '@/domain/regulatory/auditCheckInputBuilder';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface RegulatoryFindingsRealDataResult {
  /** 生成された findings 一覧 */
  findings: AuditFinding[];
  /** 全利用者の AuditCheckInput（root cause 分析用） */
  inputs: AuditCheckInput[];
  /** データ読み込み中 */
  isLoading: boolean;
  /** エラー */
  error: Error | null;
  /** データソースの説明（UI 表示用） */
  dataSourceLabel: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 通常 finding の実データを収集して AuditFinding[] を構築する
 *
 * @param users - useUsers(full) から取得した利用者データ
 * @param staff - useStaff() から取得した職員データ
 * @param isLoading - データ読み込み中かどうか
 * @param error - データ取得エラー
 * @param planningSheetRepo - PlanningSheetRepository
 * @param procedureRecordRepo - ProcedureRecordRepository（手順記録取得用）
 * @param monitoringMeetingRepo - MonitoringMeetingRepository（モニタリング取得用）
 */
export function useRegulatoryFindingsRealData(
  users: IUserMaster[],
  staff: Staff[],
  isLoading: boolean,
  error: Error | null,
  planningSheetRepo?: PlanningSheetRepository | null,
  procedureRecordRepo?: ProcedureRecordRepository | null,
  monitoringMeetingRepo?: MonitoringMeetingRepository | null,
): RegulatoryFindingsRealDataResult {

  // ── PlanningSheet を非同期に取得 ──
  const [sheetsByUser, setSheetsByUser] = useState<Map<string, PlanningSheetListItem[]>>(new Map());
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState<Error | null>(null);

  // ── ProcedureRecord を非同期に取得 ──
  const [recordsBySheet, setRecordsBySheet] = useState<Map<string, RecordMinimal[]>>(new Map());
  const [recordsLoading, setRecordsLoading] = useState(false);

  // ── MonitoringMeeting を非同期に取得 ──
  const [meetingsByUser, setMeetingsByUser] = useState<Map<string, MonitoringMeetingRecord[]>>(new Map());
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  // 有効な利用者IDリスト（安定参照）
  const activeUserIds = useMemo(() => {
    if (isLoading || error || users.length === 0) return [];
    return users
      .filter(u => u.IsActive !== false)
      .map(u => u.UserID ?? `user-${u.Id}`);
  }, [users, isLoading, error]);
  const activeUserIdsKey = useMemo(() => activeUserIds.join('|'), [activeUserIds]);
  const planningFetchStateRef = useRef<{ inFlightKey: string | null; completedKey: string | null }>({
    inFlightKey: null,
    completedKey: null,
  });
  const meetingFetchStateRef = useRef<{ inFlightKey: string | null; completedKey: string | null }>({
    inFlightKey: null,
    completedKey: null,
  });

  // ── Phase 1: PlanningSheet 取得 ──
  const fetchPlanningSheets = useCallback(async () => {
    if (!planningSheetRepo || activeUserIds.length === 0) {
      setSheetsByUser(new Map());
      planningFetchStateRef.current = { inFlightKey: null, completedKey: null };
      return;
    }
    const requestKey = activeUserIdsKey;
    if (
      planningFetchStateRef.current.inFlightKey === requestKey ||
      planningFetchStateRef.current.completedKey === requestKey
    ) {
      return;
    }
    planningFetchStateRef.current.inFlightKey = requestKey;

    setSheetsLoading(true);
    setSheetsError(null);

    try {
      const results = new Map<string, PlanningSheetListItem[]>();

      const promises = activeUserIds.map(async (userId) => {
        try {
          const sheets = await planningSheetRepo.listCurrentByUser(userId);
          results.set(userId, sheets);
        } catch (err) {
          console.warn(`[useRegulatoryFindingsRealData] Failed to fetch sheets for ${userId}:`, err);
          results.set(userId, []);
        }
      });

      await Promise.all(promises);
      setSheetsByUser(results);
      planningFetchStateRef.current.completedKey = requestKey;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setSheetsError(e);
      console.warn('[useRegulatoryFindingsRealData] PlanningSheet fetch failed:', e.message);
      planningFetchStateRef.current.completedKey = null;
    } finally {
      if (planningFetchStateRef.current.inFlightKey === requestKey) {
        planningFetchStateRef.current.inFlightKey = null;
      }
      setSheetsLoading(false);
    }
  }, [planningSheetRepo, activeUserIds, activeUserIdsKey]);

  useEffect(() => {
    fetchPlanningSheets();
  }, [fetchPlanningSheets]);

  // ── Phase 2: ProcedureRecord 取得（PlanningSheet 確定後） ──
  const fetchProcedureRecords = useCallback(async () => {
    if (!procedureRecordRepo || sheetsByUser.size === 0 || sheetsLoading) {
      setRecordsBySheet(new Map());
      return;
    }

    // 全シート ID を収集
    const allSheetIds: string[] = [];
    for (const sheets of sheetsByUser.values()) {
      for (const sheet of sheets) {
        if (sheet.isCurrent && sheet.status !== 'archived') {
          allSheetIds.push(sheet.id);
        }
      }
    }

    if (allSheetIds.length === 0) {
      setRecordsBySheet(new Map());
      return;
    }

    setRecordsLoading(true);
    try {
      const results = new Map<string, RecordMinimal[]>();

      const promises = allSheetIds.map(async (sheetId) => {
        try {
          const records: ProcedureRecordListItem[] =
            await procedureRecordRepo.listByPlanningSheet(sheetId);
          results.set(
            sheetId,
            records.map(r => ({
              id: r.id,
              planningSheetId: r.planningSheetId,
              recordDate: r.recordDate,
            })),
          );
        } catch (err) {
          console.warn(`[useRegulatoryFindingsRealData] Failed to fetch records for sheet ${sheetId}:`, err);
          results.set(sheetId, []);
        }
      });

      await Promise.all(promises);
      setRecordsBySheet(results);
    } finally {
      setRecordsLoading(false);
    }
  }, [procedureRecordRepo, sheetsByUser, sheetsLoading]);

  useEffect(() => {
    fetchProcedureRecords();
  }, [fetchProcedureRecords]);

  // ── Phase 3: MonitoringMeeting 取得 ──
  const fetchMonitoringMeetings = useCallback(async () => {
    if (!monitoringMeetingRepo || activeUserIds.length === 0) {
      setMeetingsByUser(new Map());
      meetingFetchStateRef.current = { inFlightKey: null, completedKey: null };
      return;
    }
    const requestKey = activeUserIdsKey;
    if (
      meetingFetchStateRef.current.inFlightKey === requestKey ||
      meetingFetchStateRef.current.completedKey === requestKey
    ) {
      return;
    }
    meetingFetchStateRef.current.inFlightKey = requestKey;

    setMeetingsLoading(true);
    try {
      const results = new Map<string, MonitoringMeetingRecord[]>();

      const promises = activeUserIds.map(async (userId) => {
        try {
          const meetings = await monitoringMeetingRepo.listByUser(userId);
          results.set(userId, meetings);
        } catch (err) {
          console.warn(`[useRegulatoryFindingsRealData] Failed to fetch meetings for ${userId}:`, err);
          results.set(userId, []);
        }
      });

      await Promise.all(promises);
      setMeetingsByUser(results);
      meetingFetchStateRef.current.completedKey = requestKey;
    } finally {
      if (meetingFetchStateRef.current.inFlightKey === requestKey) {
        meetingFetchStateRef.current.inFlightKey = null;
      }
      setMeetingsLoading(false);
    }
  }, [monitoringMeetingRepo, activeUserIds, activeUserIdsKey]);

  useEffect(() => {
    fetchMonitoringMeetings();
  }, [fetchMonitoringMeetings]);

  // ── 統合状態 ──
  const combinedLoading = isLoading || sheetsLoading || recordsLoading || meetingsLoading;
  const combinedError = error || sheetsError;

  // ── findings 構築 ──
  const result = useMemo<{ findings: AuditFinding[]; inputs: AuditCheckInput[] }>(() => {
    if (combinedLoading || combinedError) return { findings: [], inputs: [] };
    if (users.length === 0) return { findings: [], inputs: [] };

    const today = new Date().toISOString().slice(0, 10);

    const inputs = buildAllAuditCheckInputs(
      { 
        users, 
        staff, 
        sheetsByUser, 
        recordsBySheet, 
        monitoringMeetingsByUser: meetingsByUser 
      },
      today,
    );

    _resetFindingCounter();
    const findings: AuditFinding[] = [];
    for (const input of inputs) {
      findings.push(...buildRegulatoryFindings(input));
    }

    return { findings, inputs };
  }, [users, staff, sheetsByUser, recordsBySheet, meetingsByUser, combinedLoading, combinedError]);

  const isRealData = !combinedLoading && !combinedError && users.length > 0;

  return {
    findings: result.findings,
    inputs: result.inputs,
    isLoading: combinedLoading,
    error: combinedError,
    dataSourceLabel: isRealData ? '実データ' : 'デモデータ',
  };
}
