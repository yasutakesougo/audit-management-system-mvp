// ---------------------------------------------------------------------------
// useCSVImport — CSVインポートオーケストレーションフック
//
// ファイル選択 → パース → 自動リンク → ストア保存の全パイプラインを管理。
// A-Layer（CsvImportPage）から呼び出される。
// ---------------------------------------------------------------------------
import { useCallback, useRef, useState } from 'react';

import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { autoLinkBipToProcedures } from '@/features/import/domain/autoLinkBipToProcedures';
import { parseCarePointsCsv } from '@/features/import/domain/parseCarePointsCsv';
import { parseSupportTemplateCsv } from '@/features/import/domain/parseSupportTemplateCsv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportStatus = 'idle' | 'previewing' | 'saving' | 'done' | 'error';

export type ImportPreview = {
  /** ユーザーコード → リンク済み ScheduleItem[] */
  procedures: Map<string, ScheduleItem[]>;
  /** ユーザーコード → BIP[] */
  plans: Map<string, BehaviorInterventionPlan[]>;
  /** サマリー統計 */
  summary: ImportSummary;
};

export type ImportSummary = {
  userCount: number;
  procedureCount: number;
  planCount: number;
  linkCount: number;
  skippedRows: number;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCSVImport() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const procedureStore = useProcedureStore();
  const interventionStore = useInterventionStore();

  // file refs to track selected files
  const supportFileRef = useRef<File | null>(null);
  const careFileRef = useRef<File | null>(null);

  /** ファイル選択 */
  const selectFile = useCallback((type: 'support' | 'care', file: File | null) => {
    if (type === 'support') {
      supportFileRef.current = file;
    } else {
      careFileRef.current = file;
    }
    // ファイルが変わったらプレビューをリセット
    setPreview(null);
    setStatus('idle');
    setError(null);
  }, []);

  /** パース + 自動リンク → プレビュー生成 */
  const generatePreview = useCallback(async () => {
    setError(null);

    const supportFile = supportFileRef.current;
    const careFile = careFileRef.current;

    if (!supportFile && !careFile) {
      setError('CSVファイルを1つ以上選択してください。');
      return;
    }

    try {
      setStatus('previewing');

      // パース
      let procedureMap = new Map<string, ScheduleItem[]>();
      let planMap = new Map<string, BehaviorInterventionPlan[]>();
      let totalSkipped = 0;

      if (supportFile) {
        const text = await supportFile.text();
        const result = parseSupportTemplateCsv(text);
        procedureMap = result.data;
        totalSkipped += result.skippedRows;
      }

      if (careFile) {
        const text = await careFile.text();
        const result = parseCarePointsCsv(text);
        planMap = result.data;
        totalSkipped += result.skippedRows;
      }

      // 自動リンク: ユーザーごとに紐付け
      let totalLinks = 0;
      for (const [userCode, procs] of procedureMap) {
        const userPlans = planMap.get(userCode) ?? [];
        if (userPlans.length === 0) continue;

        const linked = autoLinkBipToProcedures(procs, userPlans);
        procedureMap.set(userCode, linked);

        // リンクされた手順をカウント
        for (const item of linked) {
          totalLinks += (item.linkedInterventionIds?.length ?? 0);
        }
      }

      // サマリー計算
      const allUserCodes = new Set([...procedureMap.keys(), ...planMap.keys()]);
      let totalProcedures = 0;
      let totalPlans = 0;
      for (const items of procedureMap.values()) totalProcedures += items.length;
      for (const plans of planMap.values()) totalPlans += plans.length;

      const summary: ImportSummary = {
        userCount: allUserCodes.size,
        procedureCount: totalProcedures,
        planCount: totalPlans,
        linkCount: totalLinks,
        skippedRows: totalSkipped,
      };

      setPreview({ procedures: procedureMap, plans: planMap, summary });
      setStatus('previewing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'パースエラーが発生しました。');
      setStatus('error');
    }
  }, []);

  /** プレビュー結果をストアに保存 */
  const saveToStores = useCallback(() => {
    if (!preview) return;

    try {
      setStatus('saving');

      // ProcedureStore に保存
      for (const [userCode, items] of preview.procedures) {
        procedureStore.save(userCode, items);
      }

      // InterventionStore に保存
      for (const [userCode, plans] of preview.plans) {
        interventionStore.save(userCode, plans);
      }

      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存中にエラーが発生しました。');
      setStatus('error');
    }
  }, [preview, procedureStore, interventionStore]);

  /** リセット */
  const reset = useCallback(() => {
    supportFileRef.current = null;
    careFileRef.current = null;
    setPreview(null);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    preview,
    error,
    selectFile,
    generatePreview,
    saveToStores,
    reset,
  } as const;
}
