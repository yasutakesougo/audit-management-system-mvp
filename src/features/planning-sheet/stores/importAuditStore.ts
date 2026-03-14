/**
 * importAuditStore.ts — 取込監査メモの永続化ストア
 *
 * アセスメント→支援計画シートへの取込操作を記録し、
 * localStorage に永続化する。ページリロード後も出典を参照可能。
 *
 * 設計方針:
 *  - assessmentStore.ts と同じ Zustand + localStorage パターン
 *  - planningSheetId をキーとして記録をグルーピング
 *  - 古い記録は自動クリーンアップ（MAX_RECORDS_PER_SHEET 件を超えた分）
 */
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import { useCallback } from 'react';
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 取込操作の記録 */
export interface ImportAuditRecord {
  /** レコード ID（UUID v4 相当） */
  id: string;
  /** 対象の支援計画シート ID */
  planningSheetId: string;
  /** 取込日時（ISO 8601） */
  importedAt: string;
  /** 取込実行者の表示名 */
  importedBy: string;
  /** 使用したアセスメント ID（null = モニタリング取込等） */
  assessmentId: string | null;
  /** 使用した特性アンケート回答 ID（null = アセスメントのみモード） */
  tokuseiResponseId: string | null;
  /** 取込モード */
  mode: 'assessment-only' | 'with-tokusei' | 'behavior-monitoring';
  /** 変更されたフィールド一覧 */
  affectedFields: string[];
  /** 変換根拠（ProvenanceEntry 全体を保存） */
  provenance: ProvenanceEntry[];
  /** サマリーテキスト（トースト表示用） */
  summaryText: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'audit__import_audit_records';
const MAX_RECORDS_PER_SHEET = 20;

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

interface StoragePayload {
  version: 1;
  records: Record<string, ImportAuditRecord[]>;
}

function loadFromStorage(): Record<string, ImportAuditRecord[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoragePayload;
    if (parsed.version !== 1) return {};
    return parsed.records;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function persistToStorage(records: Record<string, ImportAuditRecord[]>) {
  try {
    const payload: StoragePayload = { version: 1, records };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 容量制限 → 最も古い記録を削除して再試行
    console.warn('[importAuditStore] localStorage write failed; pruning old records');
    const pruned: Record<string, ImportAuditRecord[]> = {};
    for (const [key, list] of Object.entries(records)) {
      pruned[key] = list.slice(-5); // 各シート最新5件のみ保持
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: pruned }));
    } catch {
      // それでも失敗 → 諦めて次回に任せる
    }
  }
}

// ---------------------------------------------------------------------------
// ID generator (crypto.randomUUID fallback)
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface ImportAuditStoreState {
  /** planningSheetId → ImportAuditRecord[] */
  records: Record<string, ImportAuditRecord[]>;
}

const useImportAuditStoreBase = create<ImportAuditStoreState>()(() => ({
  records: loadFromStorage(),
}));

function addRecord(record: ImportAuditRecord) {
  useImportAuditStoreBase.setState((state) => {
    const sheetId = record.planningSheetId;
    const existing = state.records[sheetId] ?? [];
    const updated = [...existing, record];
    // 古い記録をトリミング
    const trimmed = updated.length > MAX_RECORDS_PER_SHEET
      ? updated.slice(-MAX_RECORDS_PER_SHEET)
      : updated;
    const newRecords = { ...state.records, [sheetId]: trimmed };
    persistToStorage(newRecords);
    return { records: newRecords };
  });
}

/** テスト用: store をリセット */
export function __resetImportAuditStore() {
  useImportAuditStoreBase.setState({ records: {} });
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useImportAuditStore() {
  const records = useImportAuditStoreBase((s) => s.records);

  const getBySheetId = useCallback(
    (planningSheetId: string): ImportAuditRecord[] => {
      return records[planningSheetId] ?? [];
    },
    [records],
  );

  const saveAuditRecord = useCallback(
    (params: Omit<ImportAuditRecord, 'id'>) => {
      const record: ImportAuditRecord = {
        ...params,
        id: generateId(),
      };
      addRecord(record);
      return record;
    },
    [],
  );

  const getAllProvenance = useCallback(
    (planningSheetId: string): ProvenanceEntry[] => {
      const sheetRecords = records[planningSheetId] ?? [];
      return sheetRecords.flatMap((r) => r.provenance);
    },
    [records],
  );

  return {
    getBySheetId,
    saveAuditRecord,
    getAllProvenance,
  } as const;
}
