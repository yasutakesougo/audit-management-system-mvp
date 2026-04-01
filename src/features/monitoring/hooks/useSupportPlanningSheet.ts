/**
 * @fileoverview SupportPlanningSheet React Hook
 * @description
 * Phase 5-C1:
 *   SupportPlanningSheet_Master への保存・取得を管理する。
 *
 * 責務:
 * - userId 単位でレコードを取得
 * - ドラフト保存（ISP 判断結果の計画書記録）
 * - 保存中 / エラー状態の管理
 * - 保存後のリフレッシュ
 *
 * 使い方:
 * ```ts
 * const { records, saveDraft, isSaving, error } =
 *   useSupportPlanningSheet(userId);
 * ```
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  SaveSupportPlanningSheetInput,
  SupportPlanningSheetRecord,
} from '../domain/supportPlanningSheetTypes';
import { useSupportPlanningSheetRepository } from '../data/createSupportPlanningSheetRepository';

// ────────────────────────────────────────────────────────

export interface UseSupportPlanningSheetResult {
  /** 取得済みレコード配列（decisionAt 降順） */
  records: SupportPlanningSheetRecord[];
  /** 最新レコード（存在しない場合は null） */
  latestRecord: SupportPlanningSheetRecord | null;
  /** ドラフト保存 */
  saveDraft: (input: SaveSupportPlanningSheetInput) => Promise<SupportPlanningSheetRecord | null>;
  /** ロード中フラグ */
  isLoading: boolean;
  /** 保存中フラグ */
  isSaving: boolean;
  /** 最新エラー */
  error: Error | null;
  /** 保存済みフラグ（最後の save が成功したか） */
  hasSaved: boolean;
}

// ────────────────────────────────────────────────────────

/**
 * SupportPlanningSheet Hook
 *
 * @param userId 対象ユーザー ID
 */
export function useSupportPlanningSheet(
  userId: string,
): UseSupportPlanningSheetResult {
  const [records, setRecords] = useState<SupportPlanningSheetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const mountedRef = useRef(true);

  // ─── リポジトリ取得 ─────────────────────────────────
  const repository = useSupportPlanningSheetRepository();

  // ─── マウント管理 ─────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── 初回ロード ─────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    setIsLoading(true);

    void (async () => {
      try {
        const result = await repository.list({
          userId,
          signal: controller.signal,
        });
        if (mountedRef.current) {
          setRecords(result);
          setError(null);
        }
      } catch (e) {
        if (mountedRef.current && !controller.signal.aborted) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [userId, repository]);

  // ─── 最新レコード ─────────────────────────────────────
  const latestRecord = useMemo(
    () => (records.length > 0 ? records[0] : null),
    [records],
  );

  // ─── 保存ハンドラ ───────────────────────────────────
  const saveDraft = useCallback(async (
    input: SaveSupportPlanningSheetInput,
  ): Promise<SupportPlanningSheetRecord | null> => {
    setIsSaving(true);
    setError(null);
    setHasSaved(false);

    try {
      const saved = await repository.save(input);

      if (mountedRef.current) {
        setRecords(prev => [saved, ...prev]);
        setHasSaved(true);
      }

      return saved;
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [repository]);

  return {
    records,
    latestRecord,
    saveDraft,
    isLoading,
    isSaving,
    error,
    hasSaved,
  };
}
