// ---------------------------------------------------------------------------
// IBD ストア — SPS・観察ログの状態管理と算定要件ロジック
// Zustand ベースのリアクティブストア
// ---------------------------------------------------------------------------
import { create } from 'zustand';

import type {
    ABCRecord,
    SPSAlertLevel,
    SPSHistoryEntry,
    SupervisionLog,
    SupportPlanSheet,
} from './ibdTypes';
import {
    calculateNextReviewDueDate,
    daysUntilSPSReview,
    getSPSAlertLevel,
} from './ibdTypes';
import {
  getSupervisionAlertLevel as getDomainSupervisionAlertLevel,
  getSupervisionAlertMessage as getDomainSupervisionAlertMessage,
  type SupervisionAlertLevel as DomainSupervisionAlertLevel,
  type SupervisionCounter as DomainSupervisionCounter,
} from '@/domain/ibd/supervisionTracking';
import { localBehaviorObservationRepository } from '@/infra/localStorage/localBehaviorObservationRepository';
import { localSupervisionTrackingRepository } from '@/infra/localStorage/localSupervisionTrackingRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SPSAlert {
  sps: SupportPlanSheet;
  daysRemaining: number;
  level: SPSAlertLevel;
}
export type SupervisionCounter = DomainSupervisionCounter;
export type SupervisionAlertLevel = DomainSupervisionAlertLevel;

/** SPS確定権限の判定結果 */
export interface CanConfirmResult {
  allowed: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface IbdState {
  spsSheets: SupportPlanSheet[];
  spsHistory: SPSHistoryEntry[];
}

const initialState: IbdState = {
  spsSheets: [],
  spsHistory: [],
};

export const useIbdStore = create<IbdState>()(() => ({ ...initialState }));

// 非 React 用のヘルパー
const getState = useIbdStore.getState;
const setState = useIbdStore.setState;

// ---------------------------------------------------------------------------
// SPS CRUD
// ---------------------------------------------------------------------------

export function addSPS(sps: Omit<SupportPlanSheet, 'nextReviewDueDate'>): void {
  const nextReviewDueDate = calculateNextReviewDueDate(sps.createdAt);
  const fullSPS: SupportPlanSheet = { ...sps, nextReviewDueDate };
  setState((s) => ({ spsSheets: [...s.spsSheets, fullSPS] }));
}

export function updateSPS(id: string, updates: Partial<SupportPlanSheet>): void {
  setState((s) => ({
    spsSheets: s.spsSheets.map((sps) => {
      if (sps.id !== id) return sps;
      const updated = { ...sps, ...updates };
      // 確定更新の場合は次回見直し期限を再計算
      if (updates.updatedAt && updates.status === 'confirmed') {
        updated.nextReviewDueDate = calculateNextReviewDueDate(updates.updatedAt);
      }
      return updated;
    }),
  }));
}

export function removeSPS(id: string): void {
  setState((s) => ({ spsSheets: s.spsSheets.filter((sps) => sps.id !== id) }));
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
  setState((s) => ({
    spsSheets: s.spsSheets.map((sps) => {
      if (sps.id !== spsId) return sps;
      const nextReviewDueDate = calculateNextReviewDueDate(confirmedAt);
      return {
        ...sps,
        status: 'confirmed' as const,
        confirmedBy: confirmedByStaffId,
        confirmedAt,
        nextReviewDueDate,
      };
    }),
  }));
}

/**
 * SPS を改訂する（モニタリングミーティング後のバージョン更新）
 * 1. 現行 SPS を SPSHistoryEntry としてスナップショット保存
 * 2. SPS の version をインクリメント（v1 → v2）
 * 3. updatedAt を現在日時に設定
 * 4. nextReviewDueDate を updatedAt + 90 日にリセット
 * 5. オプショナルな updates を SPS に適用
 */
export function reviseSPS(
  spsId: string,
  revisedBy: number | null,
  revisionReason: string,
  changesSummary: string,
  updates?: Partial<Pick<SupportPlanSheet, 'icebergModel' | 'positiveConditions'>>,
): boolean {
  const current = getState().spsSheets.find((sps) => sps.id === spsId);
  if (!current) return false;

  // 1. スナップショット保存
  const historyEntry: SPSHistoryEntry = {
    id: `history-${spsId}-${Date.now()}`,
    spsId: current.id,
    userId: current.userId,
    version: current.version,
    snapshotAt: new Date().toISOString(),
    revisedBy,
    revisionReason,
    changesSummary,
    snapshot: { ...current },
  };

  // 2-5. バージョンインクリメント + 日時更新
  const currentVersionNum = parseInt(current.version.replace('v', ''), 10) || 1;
  const newVersion = `v${currentVersionNum + 1}`;
  const now = new Date().toISOString();
  const nextReviewDueDate = calculateNextReviewDueDate(now);

  setState((s) => ({
    spsHistory: [...s.spsHistory, historyEntry],
    spsSheets: s.spsSheets.map((sps) => {
      if (sps.id !== spsId) return sps;
      return {
        ...sps,
        version: newVersion,
        updatedAt: now,
        nextReviewDueDate,
        ...(updates?.icebergModel ? { icebergModel: updates.icebergModel } : {}),
        ...(updates?.positiveConditions ? { positiveConditions: updates.positiveConditions } : {}),
      };
    }),
  }));

  return true;
}

// ---------------------------------------------------------------------------
// SPS クエリ
// ---------------------------------------------------------------------------

export function getAllSPS(): SupportPlanSheet[] {
  return getState().spsSheets;
}

export function getSPSForUser(userId: number): SupportPlanSheet[] {
  return getState().spsSheets.filter((sps) => sps.userId === userId);
}

export function getLatestSPS(userId: number): SupportPlanSheet | undefined {
  return getState().spsSheets
    .filter((sps) => sps.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// ---------------------------------------------------------------------------
// SPS 改訂履歴クエリ
// ---------------------------------------------------------------------------

export function getSPSHistory(spsId: string): SPSHistoryEntry[] {
  return getState().spsHistory
    .filter((h) => h.spsId === spsId)
    .sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt));
}

export function getSPSHistoryForUser(userId: number): SPSHistoryEntry[] {
  return getState().spsHistory
    .filter((h) => h.userId === userId)
    .sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt));
}

// ---------------------------------------------------------------------------
// SPS アラート
// ---------------------------------------------------------------------------

export function getExpiringSPSAlerts(
  daysThreshold = 30,
  today?: string,
): SPSAlert[] {
  const alerts: SPSAlert[] = [];

  for (const sps of getState().spsSheets) {
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
  return localSupervisionTrackingRepository.getCounter(userId);
}

export function incrementSupportCount(userId: number): void {
  localSupervisionTrackingRepository.incrementSupportCount(userId);
}

export function resetSupportCount(userId: number, observedAt: string): void {
  localSupervisionTrackingRepository.resetSupportCount(userId, observedAt);
}

// ---------------------------------------------------------------------------
// 観察ログ CRUD
// ---------------------------------------------------------------------------

export function addSupervisionLog(log: SupervisionLog): void {
  localSupervisionTrackingRepository.addSupervisionLog(log);
}

export function getSupervisionLogsForUser(userId: number): SupervisionLog[] {
  return localSupervisionTrackingRepository.listLogsForUser(userId);
}

// ---------------------------------------------------------------------------
// ABC分析レコード CRUD
// ---------------------------------------------------------------------------

export function addABCRecord(record: ABCRecord): void {
  localBehaviorObservationRepository.add(record);
}

export function getABCRecordsForUser(userId: string): ABCRecord[] {
  return localBehaviorObservationRepository.listByUser(userId);
}

export function getAllABCRecords(): ABCRecord[] {
  return localBehaviorObservationRepository.listAll();
}

// ---------------------------------------------------------------------------
// ストアリセット（テスト用）
// ---------------------------------------------------------------------------

export function resetIBDStore(): void {
  setState({ ...initialState });
  localBehaviorObservationRepository.clearAll();
  localSupervisionTrackingRepository.clearAll();
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

export function getSupervisionAlertLevel(supportCount: number): SupervisionAlertLevel {
  return getDomainSupervisionAlertLevel(supportCount);
}

/**
 * 観察義務アラートメッセージ
 */
export function getSupervisionAlertMessage(supportCount: number): string {
  return getDomainSupervisionAlertMessage(supportCount);
}
