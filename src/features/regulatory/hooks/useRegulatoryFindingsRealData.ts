/**
 * useRegulatoryFindingsRealData — 通常 finding の実データ収集 hook
 *
 * SP のマスタ系データを収集し、`buildRegulatoryFindings` に渡す
 * `AuditCheckInput[]` を構築する。
 *
 * アーキテクチャは `useSevereAddonRealData` と同一パターン:
 *   1. useUsers() / useStaff() で利用者・職員を取得
 *   2. PlanningSheetRepository で現行シートを取得
 *   3. 純粋関数 (auditCheckInputBuilder) で入力を組み立て
 *   4. buildRegulatoryFindings で finding を生成
 *   5. 取得不能時はデモデータにフォールバック
 *
 * @see auditCheckInputBuilder.ts — 変換純粋関数群
 * @see auditChecks.ts — buildRegulatoryFindings
 */

import { useMemo, useEffect, useState, useCallback } from 'react';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { AuditFinding, AuditCheckInput } from '@/domain/regulatory/auditChecks';
import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { PlanningSheetRepository } from '@/domain/isp/port';
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
 */
export function useRegulatoryFindingsRealData(
  users: IUserMaster[],
  staff: Staff[],
  isLoading: boolean,
  error: Error | null,
  planningSheetRepo?: PlanningSheetRepository | null,
): RegulatoryFindingsRealDataResult {

  // ── PlanningSheet を非同期に取得 ──
  const [sheetsByUser, setSheetsByUser] = useState<Map<string, PlanningSheetListItem[]>>(new Map());
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState<Error | null>(null);

  // 有効な利用者IDリスト（安定参照）
  const activeUserIds = useMemo(() => {
    if (isLoading || error || users.length === 0) return [];
    return users
      .filter(u => u.IsActive !== false)
      .map(u => u.UserID ?? `user-${u.Id}`);
  }, [users, isLoading, error]);

  const fetchPlanningSheets = useCallback(async () => {
    if (!planningSheetRepo || activeUserIds.length === 0) {
      setSheetsByUser(new Map());
      return;
    }

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
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setSheetsError(e);
      console.warn('[useRegulatoryFindingsRealData] PlanningSheet fetch failed:', e.message);
    } finally {
      setSheetsLoading(false);
    }
  }, [planningSheetRepo, activeUserIds]);

  useEffect(() => {
    fetchPlanningSheets();
  }, [fetchPlanningSheets]);

  // ── 統合状態 ──
  const combinedLoading = isLoading || sheetsLoading;
  const combinedError = error || sheetsError;

  // ── findings 構築 ──
  const result = useMemo<{ findings: AuditFinding[]; inputs: AuditCheckInput[] }>(() => {
    if (combinedLoading || combinedError) return { findings: [], inputs: [] };
    if (users.length === 0) return { findings: [], inputs: [] };

    const today = new Date().toISOString().slice(0, 10);

    // NOTE: 手順記録（RecordAuditInfo）の取得は追加 API 呼び出しが必要で、
    //   初回リリースでは空で渡す（= procedure_record_gap の検出を省略）。
    //   将来的に ProcedureRecordRepository.listByPlanningSheet を追加して接続。
    const recordsBySheet = new Map<string, RecordMinimal[]>();

    const inputs = buildAllAuditCheckInputs(
      { users, staff, sheetsByUser, recordsBySheet },
      today,
    );

    _resetFindingCounter();
    const findings: AuditFinding[] = [];
    for (const input of inputs) {
      findings.push(...buildRegulatoryFindings(input));
    }

    return { findings, inputs };
  }, [users, staff, sheetsByUser, combinedLoading, combinedError]);

  const isRealData = !combinedLoading && !combinedError && users.length > 0;

  return {
    findings: result.findings,
    inputs: result.inputs,
    isLoading: combinedLoading,
    error: combinedError,
    dataSourceLabel: isRealData ? '実データ' : 'デモデータ',
  };
}
