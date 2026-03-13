// ---------------------------------------------------------------------------
// LocalPlanningSheetVersionRepository — LocalStorage ベースの版管理永続化
//
// P2: 支援計画シートの版管理用 LocalStorage adapter。
// 既存の PlanningSheetRepository (port.ts) を拡張せず、
// 版管理専用の薄い責務として分離。
//
// 同一系列の定義: userId + ispId が同じ SupportPlanningSheet 群
// ---------------------------------------------------------------------------

import type { SupportPlanningSheet } from '@/domain/isp/schema';
import {
  createRevisionDraft,
  activatePlanningSheetVersion,
  archivePlanningSheetVersion,
  computeVersionSummary,
  getPlanningSheetVersionHistory,
  type RevisionDraftParams,
  type ActivationParams,
  type ArchiveParams,
  type PlanningSheetVersionSummary,
  type VersionHistoryDisplayEntry,
} from '@/domain/isp/planningSheetVersion';

// ---------------------------------------------------------------------------
// Storage Key & Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'planningSheet.versions.v1';
const MAX_RECORDS = 500;

// ---------------------------------------------------------------------------
// Generic Helpers (same pattern as localComplianceRepository)
// ---------------------------------------------------------------------------

function readStore(): SupportPlanningSheet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SupportPlanningSheet[];
  } catch {
    return [];
  }
}

function writeStore(records: SupportPlanningSheet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId(): string {
  return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Series Key — 同一系列の版をグルーピングするキー
// ---------------------------------------------------------------------------

function seriesKey(sheet: Pick<SupportPlanningSheet, 'userId' | 'ispId'>): string {
  return `${sheet.userId}::${sheet.ispId}`;
}

function getSeriesSheets(
  all: SupportPlanningSheet[],
  userId: string,
  ispId: string,
): SupportPlanningSheet[] {
  const key = `${userId}::${ispId}`;
  return all.filter((s) => seriesKey(s) === key);
}

// ---------------------------------------------------------------------------
// Repository Interface (版管理専用)
// ---------------------------------------------------------------------------

export interface PlanningSheetVersionRepository {
  /** 版を保存（新規 or 更新） */
  save(sheet: SupportPlanningSheet): Promise<SupportPlanningSheet>;

  /** ID で取得 */
  getById(id: string): Promise<SupportPlanningSheet | null>;

  /** 同一系列の全版を取得 */
  listVersions(userId: string, ispId: string): Promise<SupportPlanningSheet[]>;

  /** 同一系列の現行版を取得 */
  getCurrent(userId: string, ispId: string): Promise<SupportPlanningSheet | null>;

  /** 改訂版 draft を作成 — 現行版をコピーして version+1 */
  createRevision(
    currentSheetId: string,
    params: RevisionDraftParams,
  ): Promise<SupportPlanningSheet>;

  /** 指定版を active に昇格。旧 active は自動で archived に */
  activate(
    sheetId: string,
    params: ActivationParams,
  ): Promise<SupportPlanningSheet[]>;

  /** 指定版をアーカイブ */
  archive(sheetId: string, params: ArchiveParams): Promise<SupportPlanningSheet>;

  /** 版番号降順の履歴を返す */
  getVersionHistory(
    userId: string,
    ispId: string,
  ): Promise<VersionHistoryDisplayEntry[]>;

  /** 版管理サマリを返す */
  getVersionSummary(
    userId: string,
    ispId: string,
  ): Promise<PlanningSheetVersionSummary>;

  /** 全レコード削除（テスト用） */
  _clearAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// LocalStorage Implementation
// ---------------------------------------------------------------------------

export const localPlanningSheetVersionRepository: PlanningSheetVersionRepository = {
  async save(sheet: SupportPlanningSheet): Promise<SupportPlanningSheet> {
    const all = readStore();
    const existingIndex = all.findIndex((s) => s.id === sheet.id);

    const saved: SupportPlanningSheet = {
      ...sheet,
      id: sheet.id || generateId(),
    };

    if (existingIndex >= 0) {
      all[existingIndex] = saved;
    } else {
      all.unshift(saved);
      if (all.length > MAX_RECORDS) {
        all.length = MAX_RECORDS;
      }
    }

    writeStore(all);
    return saved;
  },

  async getById(id: string): Promise<SupportPlanningSheet | null> {
    return readStore().find((s) => s.id === id) ?? null;
  },

  async listVersions(
    userId: string,
    ispId: string,
  ): Promise<SupportPlanningSheet[]> {
    return getSeriesSheets(readStore(), userId, ispId).sort(
      (a, b) => b.version - a.version,
    );
  },

  async getCurrent(
    userId: string,
    ispId: string,
  ): Promise<SupportPlanningSheet | null> {
    const series = getSeriesSheets(readStore(), userId, ispId);
    return (
      series.find((s) => s.isCurrent && s.status === 'active') ?? null
    );
  },

  async createRevision(
    currentSheetId: string,
    params: RevisionDraftParams,
  ): Promise<SupportPlanningSheet> {
    const all = readStore();
    const current = all.find((s) => s.id === currentSheetId);
    if (!current) {
      throw new Error(`Sheet not found: ${currentSheetId}`);
    }

    const draft = createRevisionDraft(current, params);
    draft.id = generateId();

    all.unshift(draft);
    if (all.length > MAX_RECORDS) {
      all.length = MAX_RECORDS;
    }

    writeStore(all);
    return draft;
  },

  async activate(
    sheetId: string,
    params: ActivationParams,
  ): Promise<SupportPlanningSheet[]> {
    const all = readStore();
    const target = all.find((s) => s.id === sheetId);
    if (!target) {
      throw new Error(`Sheet not found: ${sheetId}`);
    }

    // 同一系列の版だけを版切替対象にする
    const series = getSeriesSheets(all, target.userId, target.ispId);
    const updatedSeries = activatePlanningSheetVersion(
      series,
      sheetId,
      params,
    );

    // 全ストアの中で、該当系列の版だけを差し替える
    const key = seriesKey(target);
    const updatedAll = all.map((s) => {
      if (seriesKey(s) !== key) return s;
      const updated = updatedSeries.find((u) => u.id === s.id);
      return updated ?? s;
    });

    writeStore(updatedAll);
    return updatedSeries;
  },

  async archive(
    sheetId: string,
    params: ArchiveParams,
  ): Promise<SupportPlanningSheet> {
    const all = readStore();
    const target = all.find((s) => s.id === sheetId);
    if (!target) {
      throw new Error(`Sheet not found: ${sheetId}`);
    }

    const archived = archivePlanningSheetVersion(target, params);
    const updatedAll = all.map((s) =>
      s.id === sheetId ? archived : s,
    );

    writeStore(updatedAll);
    return archived;
  },

  async getVersionHistory(
    userId: string,
    ispId: string,
  ): Promise<VersionHistoryDisplayEntry[]> {
    const series = getSeriesSheets(readStore(), userId, ispId);
    return getPlanningSheetVersionHistory(series);
  },

  async getVersionSummary(
    userId: string,
    ispId: string,
  ): Promise<PlanningSheetVersionSummary> {
    const series = getSeriesSheets(readStore(), userId, ispId);
    return computeVersionSummary(series);
  },

  async _clearAll(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  },
};
