// ---------------------------------------------------------------------------
// useUnifiedCSVImport — 統合CSVインポートフック
//
// 利用者マスタ / 日課表 / 要配慮事項 の3種のCSVインポートを
// 統合管理するオーケストレーションフック。
// ---------------------------------------------------------------------------
import { useCallback, useRef, useState } from 'react';

import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { useProcedureStore } from '@/features/daily/hooks/legacy-stores/procedureStore';
import { autoLinkBipToProcedures } from '@/features/import/domain/autoLinkBipToProcedures';
import { parseCarePointsCsv } from '@/features/import/domain/parseCarePointsCsv';
import { parseSupportTemplateCsv } from '@/features/import/domain/parseSupportTemplateCsv';
import {
  parseUsersMasterCsv,
  validateUserRecords,
  type ParsedUserRecord,
  type ValidationIssue,
} from '@/features/import/domain/parseUsersMasterCsv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportTarget = 'users' | 'support' | 'care';

export type ImportStatus = 'idle' | 'previewing' | 'saving' | 'done' | 'error';

export type ImportSummary = {
  userCount: number;
  recordCount: number;
  skippedRows: number;
  totalRows: number;
};

export type ImportPreviewBase = {
  summary: ImportSummary;
  validationIssues: ValidationIssue[];
};

export type UsersImportPreview = ImportPreviewBase & {
  target: 'users';
  data: Map<string, ParsedUserRecord[]>;
  /** プレビュー用テーブルデータ */
  tableRows: ParsedUserRecord[];
};

export type SupportImportPreview = ImportPreviewBase & {
  target: 'support';
  data: Map<string, ScheduleItem[]>;
};

export type CareImportPreview = ImportPreviewBase & {
  target: 'care';
  data: Map<string, BehaviorInterventionPlan[]>;
};

export type UnifiedImportPreview =
  | UsersImportPreview
  | SupportImportPreview
  | CareImportPreview;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUnifiedCSVImport() {
  const [activeTarget, setActiveTarget] = useState<ImportTarget>('users');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [preview, setPreview] = useState<UnifiedImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const procedureStore = useProcedureStore();
  const interventionStore = useInterventionStore();

  const fileRef = useRef<File | null>(null);

  /** アクティブなインポートターゲットを切り替え */
  const switchTarget = useCallback((target: ImportTarget) => {
    setActiveTarget(target);
    setPreview(null);
    setStatus('idle');
    setError(null);
    fileRef.current = null;
  }, []);

  /** ファイル選択 */
  const selectFile = useCallback((file: File | null) => {
    fileRef.current = file;
    setPreview(null);
    setStatus('idle');
    setError(null);
  }, []);

  /** プレビュー生成 */
  const generatePreview = useCallback(async () => {
    setError(null);
    const file = fileRef.current;
    if (!file) {
      setError('CSVファイルを選択してください。');
      return;
    }

    try {
      setStatus('previewing');
      const text = await file.text();

      switch (activeTarget) {
        case 'users': {
          const result = parseUsersMasterCsv(text);
          const issues = validateUserRecords(result.data);
          const tableRows: ParsedUserRecord[] = [];
          for (const items of result.data.values()) {
            tableRows.push(...items);
          }

          setPreview({
            target: 'users',
            data: result.data,
            tableRows,
            validationIssues: issues,
            summary: {
              userCount: result.data.size,
              recordCount: tableRows.length,
              skippedRows: result.skippedRows,
              totalRows: result.totalRows,
            },
          });
          break;
        }

        case 'support': {
          const result = parseSupportTemplateCsv(text);
          let totalItems = 0;
          for (const items of result.data.values()) totalItems += items.length;

          setPreview({
            target: 'support',
            data: result.data,
            validationIssues: [],
            summary: {
              userCount: result.data.size,
              recordCount: totalItems,
              skippedRows: result.skippedRows,
              totalRows: result.totalRows,
            },
          });
          break;
        }

        case 'care': {
          const result = parseCarePointsCsv(text);
          let totalItems = 0;
          for (const items of result.data.values()) totalItems += items.length;

          setPreview({
            target: 'care',
            data: result.data,
            validationIssues: [],
            summary: {
              userCount: result.data.size,
              recordCount: totalItems,
              skippedRows: result.skippedRows,
              totalRows: result.totalRows,
            },
          });
          break;
        }
      }

      setStatus('previewing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSVパース中にエラーが発生しました。');
      setStatus('error');
    }
  }, [activeTarget]);

  /** ストアに保存 */
  const saveToStores = useCallback(() => {
    if (!preview) return;

    try {
      setStatus('saving');

      switch (preview.target) {
        case 'users': {
          // Users はローカルストレージに保存（デモモード用）
          const existing = localStorage.getItem('csvImport.users.v1');
          const existingData: ParsedUserRecord[] = existing ? JSON.parse(existing) : [];

          // 新しいデータで既存を上書き（UserID で dedup）
          const merged = new Map<string, ParsedUserRecord>();
          for (const rec of existingData) merged.set(rec.UserID, rec);
          for (const items of preview.data.values()) {
            for (const rec of items) merged.set(rec.UserID, rec);
          }

          localStorage.setItem(
            'csvImport.users.v1',
            JSON.stringify(Array.from(merged.values())),
          );
          break;
        }

        case 'support': {
          for (const [userCode, items] of preview.data) {
            procedureStore.save(userCode, items);
          }
          break;
        }

        case 'care': {
          for (const [userCode, plans] of preview.data) {
            interventionStore.save(userCode, plans);
          }
          break;
        }
      }

      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存中にエラーが発生しました。');
      setStatus('error');
    }
  }, [preview, procedureStore, interventionStore]);

  /** 自動リンク実行（日課表 + 要配慮事項の両方がある場合） */
  const autoLink = useCallback((
    supportData: Map<string, ScheduleItem[]>,
    careData: Map<string, BehaviorInterventionPlan[]>,
  ): { linkedProcedures: Map<string, ScheduleItem[]>; linkCount: number } => {
    let totalLinks = 0;
    const linkedProcedures = new Map(supportData);

    for (const [userCode, procs] of linkedProcedures) {
      const userPlans = careData.get(userCode) ?? [];
      if (userPlans.length === 0) continue;

      const linked = autoLinkBipToProcedures(procs, userPlans);
      linkedProcedures.set(userCode, linked);

      for (const item of linked) {
        totalLinks += (item.linkedInterventionIds?.length ?? 0);
      }
    }

    return { linkedProcedures, linkCount: totalLinks };
  }, []);

  /** リセット */
  const reset = useCallback(() => {
    fileRef.current = null;
    setPreview(null);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    activeTarget,
    status,
    preview,
    error,
    switchTarget,
    selectFile,
    generatePreview,
    saveToStores,
    autoLink,
    reset,
  } as const;
}
