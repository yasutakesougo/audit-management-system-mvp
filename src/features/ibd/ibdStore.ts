// ---------------------------------------------------------------------------
// IBD ストア — SPS・観察ログの状態管理と算定要件ロジック
// Module-level store pattern（zustand 不使用、プロジェクト慣習に準拠）
// ---------------------------------------------------------------------------
import type {
    ABCRecord,
    SPSAlertLevel,
    SupervisionLog,
    SupportPlanSheet,
} from './ibdTypes';
import {
    calculateNextReviewDueDate,
    daysUntilSPSReview,
    getSPSAlertLevel,
} from './ibdTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SPSAlert {
  sps: SupportPlanSheet;
  daysRemaining: number;
  level: SPSAlertLevel;
}

/** 観察カウンター: 利用者ごとに未観察の支援回数を管理 */
export interface SupervisionCounter {
  userId: number;
  supportCount: number;      // 未観察の支援回数
  lastObservedAt: string | null; // 最終観察日
}

/** SPS確定権限の判定結果 */
export interface CanConfirmResult {
  allowed: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

let _spsSheets: SupportPlanSheet[] = [];
let _supervisionLogs: SupervisionLog[] = [];
let _supervisionCounters: SupervisionCounter[] = [];
let _abcRecords: ABCRecord[] = [];

// ---------------------------------------------------------------------------
// SPS CRUD
// ---------------------------------------------------------------------------

export function addSPS(sps: Omit<SupportPlanSheet, 'nextReviewDueDate'>): void {
  const nextReviewDueDate = calculateNextReviewDueDate(sps.createdAt);
  const fullSPS: SupportPlanSheet = { ...sps, nextReviewDueDate };
  _spsSheets = [..._spsSheets, fullSPS];
}

export function updateSPS(id: string, updates: Partial<SupportPlanSheet>): void {
  _spsSheets = _spsSheets.map((sps) => {
    if (sps.id !== id) return sps;
    const updated = { ...sps, ...updates };
    // 確定更新の場合は次回見直し期限を再計算
    if (updates.updatedAt && updates.status === 'confirmed') {
      updated.nextReviewDueDate = calculateNextReviewDueDate(updates.updatedAt);
    }
    return updated;
  });
}

export function removeSPS(id: string): void {
  _spsSheets = _spsSheets.filter((sps) => sps.id !== id);
}

/**
 * SPS を確定する（実践研修修了者のみ）
 * confirmedAt を起算点として次回見直し期限を再計算
 */
export function confirmSPS(
  spsId: string,
  confirmedByStaffId: number,
  confirmedAt: string,
): void {
  _spsSheets = _spsSheets.map((sps) => {
    if (sps.id !== spsId) return sps;
    const nextReviewDueDate = calculateNextReviewDueDate(confirmedAt);
    return {
      ...sps,
      status: 'confirmed' as const,
      confirmedBy: confirmedByStaffId,
      confirmedAt,
      nextReviewDueDate,
    };
  });
}

// ---------------------------------------------------------------------------
// SPS クエリ
// ---------------------------------------------------------------------------

export function getAllSPS(): SupportPlanSheet[] {
  return _spsSheets;
}

export function getSPSForUser(userId: number): SupportPlanSheet[] {
  return _spsSheets.filter((sps) => sps.userId === userId);
}

export function getLatestSPS(userId: number): SupportPlanSheet | undefined {
  return _spsSheets
    .filter((sps) => sps.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// ---------------------------------------------------------------------------
// SPS アラート
// ---------------------------------------------------------------------------

export function getExpiringSPSAlerts(
  daysThreshold = 30,
  today?: string,
): SPSAlert[] {
  const alerts: SPSAlert[] = [];

  for (const sps of _spsSheets) {
    if (sps.status !== 'confirmed') continue;
    const daysRemaining = daysUntilSPSReview(sps.nextReviewDueDate, today);
    if (daysRemaining <= daysThreshold) {
      alerts.push({
        sps,
        daysRemaining,
        level: getSPSAlertLevel(daysRemaining),
      });
    }
  }

  // 緊急度順にソート（期限超過が先頭）
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ---------------------------------------------------------------------------
// 観察カウンター管理
// 「2回の支援ごとに1回以上」の観察義務を追跡
// ---------------------------------------------------------------------------

export function getSupervisionCounter(userId: number): SupervisionCounter {
  return (
    _supervisionCounters.find((c) => c.userId === userId) ?? {
      userId,
      supportCount: 0,
      lastObservedAt: null,
    }
  );
}

export function incrementSupportCount(userId: number): void {
  const existing = _supervisionCounters.find((c) => c.userId === userId);
  if (existing) {
    _supervisionCounters = _supervisionCounters.map((c) =>
      c.userId === userId
        ? { ...c, supportCount: c.supportCount + 1 }
        : c
    );
  } else {
    _supervisionCounters = [
      ..._supervisionCounters,
      { userId, supportCount: 1, lastObservedAt: null },
    ];
  }
}

export function resetSupportCount(userId: number, observedAt: string): void {
  const existing = _supervisionCounters.find((c) => c.userId === userId);
  if (existing) {
    _supervisionCounters = _supervisionCounters.map((c) =>
      c.userId === userId
        ? { ...c, supportCount: 0, lastObservedAt: observedAt }
        : c
    );
  } else {
    _supervisionCounters = [
      ..._supervisionCounters,
      { userId, supportCount: 0, lastObservedAt: observedAt },
    ];
  }
}

// ---------------------------------------------------------------------------
// 観察ログ CRUD
// ---------------------------------------------------------------------------

export function addSupervisionLog(log: SupervisionLog): void {
  _supervisionLogs = [..._supervisionLogs, log];
  // 観察ログ保存時にカウンターを自動リセット
  resetSupportCount(log.userId, log.observedAt);
}

export function getSupervisionLogsForUser(userId: number): SupervisionLog[] {
  return _supervisionLogs.filter((log) => log.userId === userId);
}

// ---------------------------------------------------------------------------
// ABC分析レコード CRUD
// ---------------------------------------------------------------------------

export function addABCRecord(record: ABCRecord): void {
  _abcRecords = [..._abcRecords, record];
}

export function getABCRecordsForUser(userId: string): ABCRecord[] {
  return _abcRecords.filter((r) => r.userId === userId);
}

export function getAllABCRecords(): ABCRecord[] {
  return _abcRecords;
}

// ---------------------------------------------------------------------------
// ストアリセット（テスト用）
// ---------------------------------------------------------------------------

export function resetIBDStore(): void {
  _spsSheets = [];
  _supervisionLogs = [];
  _supervisionCounters = [];
  _abcRecords = [];
}

// ---------------------------------------------------------------------------
// Pure 関数（ストア外で使用可能）
// ---------------------------------------------------------------------------

/**
 * SPS確定操作の権限判定
 * @param hasPracticalTrainingCert 操作者が実践研修修了者か
 */
export function canConfirmSPS(hasPracticalTrainingCert: boolean): CanConfirmResult {
  if (!hasPracticalTrainingCert) {
    return {
      allowed: false,
      reason: 'SPSの確定操作は「実践研修修了者」のみ実行できます。',
    };
  }
  return { allowed: true, reason: '' };
}

/**
 * 観察義務のアラート判定
 * @param supportCount 未観察の支援回数
 */
export type SupervisionAlertLevel = 'ok' | 'warning' | 'overdue';

export function getSupervisionAlertLevel(supportCount: number): SupervisionAlertLevel {
  if (supportCount >= 2) return 'overdue';
  if (supportCount >= 1) return 'warning';
  return 'ok';
}

/**
 * 観察義務アラートメッセージ
 */
export function getSupervisionAlertMessage(supportCount: number): string {
  if (supportCount >= 2) {
    return `観察義務超過: ${supportCount}回の支援が未観察です（基準: 2回に1回以上の観察が必要）`;
  }
  if (supportCount >= 1) {
    return `次回の支援前に実践研修修了者による観察が推奨されます（現在${supportCount}回未観察）`;
  }
  return '';
}
