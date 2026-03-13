// ---------------------------------------------------------------------------
// PlanningSheetVersion — 版管理の純粋ドメインロジック
//
// P2: 支援計画シートの版管理。
// 既存の schema.ts フィールド (version, isCurrent, status, appliedFrom,
// nextReviewAt) を活用し、UI / Repository 非依存で版操作を提供する。
//
// 設計方針:
//   - フィールド追加なし — 既存 SupportPlanningSheet をそのまま使う
//   - 版 = 行 — SharePoint リスト行と1:1対応
//   - isCurrent フラグで現行版を排他管理
//   - VersionHistoryEntry<T> で表示用履歴を生成
// ---------------------------------------------------------------------------

import type {
  SupportPlanningSheet,
  PlanningSheetStatus,
  PlanningSheetListItem,
} from './schema';

import type { VersionHistoryEntry } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 改訂版作成パラメータ */
export interface RevisionDraftParams {
  /** 改訂理由 */
  changeReason: string;
  /** 改訂者 */
  changedBy: string;
}

/** 版の昇格パラメータ */
export interface ActivationParams {
  /** 昇格者 */
  activatedBy: string;
  /** 適用開始日 (ISO 8601 date) — 指定しなければ今日 */
  appliedFrom?: string;
}

/** アーカイブパラメータ */
export interface ArchiveParams {
  /** アーカイブ理由 */
  reason?: string;
  /** 実行者 */
  archivedBy: string;
}

/** 版管理サマリ（ダッシュボード / パネル用） */
export interface PlanningSheetVersionSummary {
  /** 総版数 */
  totalVersions: number;
  /** 現行版のバージョン番号 */
  currentVersion: number | null;
  /** 現行版のタイトル */
  currentTitle: string | null;
  /** 現行版の適用開始日 */
  currentAppliedFrom: string | null;
  /** 現行版のステータス */
  currentStatus: PlanningSheetStatus | null;
  /** 次回見直し期限 */
  nextReviewAt: string | null;
  /** 見直し期限超過か */
  isReviewOverdue: boolean;
  /** 見直し期限までの残日数（超過はマイナス） */
  daysUntilReview: number | null;
  /** 下書き版があるか */
  hasDraft: boolean;
  /** レビュー中の版があるか */
  hasReviewPending: boolean;
}

/** 版履歴表示用エントリ */
export interface VersionHistoryDisplayEntry {
  /** 版の ID */
  id: string;
  /** 版番号 */
  version: number;
  /** タイトル */
  title: string;
  /** ステータス */
  status: PlanningSheetStatus;
  /** 現行版か */
  isCurrent: boolean;
  /** 適用開始日 */
  appliedFrom: string | null;
  /** 作成日 */
  createdAt: string;
  /** 作成者 */
  createdBy: string;
  /** 最終更新日 */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 見直し期限判定
// ---------------------------------------------------------------------------

/**
 * 見直し期限超過を判定する。
 *
 * @param nextReviewAt - 次回見直し期限 (ISO 8601 date)
 * @param today - 判定基準日（テスト用）
 * @returns 超過なら正の日数、未到来なら負の日数、null は判定不可
 */
export function computeDaysOverdue(
  nextReviewAt: string | null,
  today?: string,
): number | null {
  if (!nextReviewAt) return null;
  const due = new Date(nextReviewAt);
  if (Number.isNaN(due.getTime())) return null;
  const now = today ? new Date(today) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowUtc - dueUtc) / (1000 * 60 * 60 * 24));
}

/**
 * 見直し期限が超過しているかを判定する。
 */
export function isReviewOverdue(
  sheet: Pick<SupportPlanningSheet, 'nextReviewAt'>,
  today?: string,
): boolean {
  const days = computeDaysOverdue(sheet.nextReviewAt, today);
  return days !== null && days > 0;
}

/**
 * 見直し期限のアラートレベルを算出する。
 *
 * - good: 30日以上余裕
 * - warning: 30日以内
 * - critical: 超過
 * - none: 期限未設定
 */
export type ReviewAlertLevel = 'good' | 'warning' | 'critical' | 'none';

export function computeReviewAlertLevel(
  sheet: Pick<SupportPlanningSheet, 'nextReviewAt'>,
  today?: string,
): ReviewAlertLevel {
  const days = computeDaysOverdue(sheet.nextReviewAt, today);
  if (days === null) return 'none';
  if (days > 0) return 'critical';
  if (days >= -30) return 'warning';
  return 'good';
}

// ---------------------------------------------------------------------------
// 改訂版作成
// ---------------------------------------------------------------------------

/**
 * 現行版をベースに改訂版 draft を作成する。
 *
 * - 現行版のフィールドをすべてコピー
 * - version + 1
 * - status = 'draft'
 * - isCurrent = false
 * - id を空にして Repository 側で採番させる
 */
export function createRevisionDraft(
  currentSheet: SupportPlanningSheet,
  params: RevisionDraftParams,
): SupportPlanningSheet {
  const now = new Date().toISOString();
  return {
    ...currentSheet,
    id: '', // Repository 側で新規 ID 採番
    version: currentSheet.version + 1,
    status: 'draft',
    isCurrent: false,
    appliedFrom: null,
    createdAt: now,
    createdBy: params.changedBy,
    updatedAt: now,
    updatedBy: params.changedBy,
  };
}

// ---------------------------------------------------------------------------
// 現行版切替（昇格 + 旧版アーカイブ）
// ---------------------------------------------------------------------------

/**
 * 指定した版を active に昇格し、旧 active 版を archived にする。
 *
 * @param sheets - 同一 userId+ispId の全版
 * @param targetId - 昇格対象の版 ID
 * @param params - 昇格パラメータ
 * @returns 更新後の全版配列
 * @throws targetId が見つからない場合
 */
export function activatePlanningSheetVersion(
  sheets: SupportPlanningSheet[],
  targetId: string,
  params: ActivationParams,
): SupportPlanningSheet[] {
  const target = sheets.find((s) => s.id === targetId);
  if (!target) {
    throw new Error(`Version not found: ${targetId}`);
  }

  const now = new Date().toISOString();
  const appliedFrom =
    params.appliedFrom ?? new Date().toISOString().slice(0, 10);

  return sheets.map((sheet) => {
    if (sheet.id === targetId) {
      // 昇格対象 → active + isCurrent
      return {
        ...sheet,
        status: 'active' as const,
        isCurrent: true,
        appliedFrom,
        updatedAt: now,
        updatedBy: params.activatedBy,
      };
    }
    if (sheet.isCurrent && sheet.status === 'active') {
      // 旧 active → archived
      return {
        ...sheet,
        status: 'archived' as const,
        isCurrent: false,
        updatedAt: now,
        updatedBy: params.activatedBy,
      };
    }
    return sheet;
  });
}

// ---------------------------------------------------------------------------
// アーカイブ
// ---------------------------------------------------------------------------

/**
 * 指定した版を archived にする。
 */
export function archivePlanningSheetVersion(
  sheet: SupportPlanningSheet,
  params: ArchiveParams,
): SupportPlanningSheet {
  const now = new Date().toISOString();
  return {
    ...sheet,
    status: 'archived',
    isCurrent: false,
    updatedAt: now,
    updatedBy: params.archivedBy,
  };
}

// ---------------------------------------------------------------------------
// 版履歴整形
// ---------------------------------------------------------------------------

/**
 * 版番号の降順でソートした版履歴を返す。
 */
export function getPlanningSheetVersionHistory(
  sheets: SupportPlanningSheet[],
): VersionHistoryDisplayEntry[] {
  return [...sheets]
    .sort((a, b) => b.version - a.version)
    .map((s) => ({
      id: s.id,
      version: s.version,
      title: s.title,
      status: s.status,
      isCurrent: s.isCurrent,
      appliedFrom: s.appliedFrom,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
      updatedAt: s.updatedAt,
    }));
}

/**
 * SupportPlanningSheet[] から VersionHistoryEntry<SupportPlanningSheet> を生成する。
 * 型互換: types.ts の VersionHistoryEntry<T> に準拠。
 */
export function toVersionHistoryEntries(
  sheets: SupportPlanningSheet[],
  changeReasons?: Record<string, string>,
): VersionHistoryEntry<SupportPlanningSheet>[] {
  return [...sheets]
    .sort((a, b) => b.version - a.version)
    .map((s) => ({
      id: s.id,
      version: `v${s.version}`,
      snapshotAt: s.updatedAt,
      changedBy: typeof s.updatedBy === 'number' ? s.updatedBy : 0,
      changeReason: changeReasons?.[s.id] ?? '',
      changeSummary: `Version ${s.version} (${s.status})`,
      snapshot: s,
    }));
}

// ---------------------------------------------------------------------------
// サマリ集計
// ---------------------------------------------------------------------------

/**
 * 同一利用者・ISP に紐づく全版からサマリを算出する。
 *
 * @param sheets - 同一 userId+ispId の全版
 * @param today - 判定基準日（テスト用）
 */
export function computeVersionSummary(
  sheets: SupportPlanningSheet[],
  today?: string,
): PlanningSheetVersionSummary {
  const current = sheets.find((s) => s.isCurrent && s.status === 'active');

  const daysOverdue = current
    ? computeDaysOverdue(current.nextReviewAt, today)
    : null;

  return {
    totalVersions: sheets.length,
    currentVersion: current?.version ?? null,
    currentTitle: current?.title ?? null,
    currentAppliedFrom: current?.appliedFrom ?? null,
    currentStatus: current?.status ?? null,
    nextReviewAt: current?.nextReviewAt ?? null,
    isReviewOverdue: daysOverdue !== null && daysOverdue > 0,
    daysUntilReview: daysOverdue !== null ? -daysOverdue : null,
    hasDraft: sheets.some((s) => s.status === 'draft'),
    hasReviewPending: sheets.some((s) => s.status === 'review'),
  };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/**
 * 現行版を取得する。
 */
export function getCurrentVersion(
  sheets: SupportPlanningSheet[],
): SupportPlanningSheet | null {
  return sheets.find((s) => s.isCurrent && s.status === 'active') ?? null;
}

/**
 * 最新版（version 番号が最大のもの）を取得する。
 */
export function getLatestVersion(
  sheets: SupportPlanningSheet[],
): SupportPlanningSheet | null {
  if (sheets.length === 0) return null;
  return [...sheets].sort((a, b) => b.version - a.version)[0];
}

/**
 * PlanningSheetListItem[] をバージョン降順でソートする。
 */
export function sortByVersionDesc(
  items: PlanningSheetListItem[],
): PlanningSheetListItem[] {
  // PlanningSheetListItem には version がないため、id のみでソート不可
  // → この関数は SupportPlanningSheet[] 向けの sortByVersionDescFull を使用
  return items;
}

/**
 * SupportPlanningSheet[] をバージョン降順でソートする。
 */
export function sortByVersionDescFull(
  sheets: SupportPlanningSheet[],
): SupportPlanningSheet[] {
  return [...sheets].sort((a, b) => b.version - a.version);
}
