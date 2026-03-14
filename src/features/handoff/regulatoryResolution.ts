/**
 * regulatoryResolution — 制度系 handoff の対応完了証跡ロジック
 *
 * P6 Phase 3: finding → 共有 → 会議 → 対応 → 完了 → 証跡
 *
 * 純粋関数のみ。テスト可能。
 */

import type { HandoffRecord } from './handoffTypes';
import { isTerminalStatus } from './handoffStateMachine';

// ─── 判定関数 ─── //

const REGULATORY_SOURCE_TYPES = new Set([
  'regulatory-finding',
  'severe-addon-finding',
]);

/**
 * 制度系 handoff かどうかを判定する
 */
export function isRegulatoryHandoff(record: HandoffRecord): boolean {
  return record.sourceType != null && REGULATORY_SOURCE_TYPES.has(record.sourceType);
}

/**
 * 対応完了証跡が揃っているかを判定する
 *
 * 条件:
 * - terminal status (対応済 or 完了) である
 * - resolvedBy が存在する
 * - resolvedAt が存在する
 */
export function hasResolutionTrail(record: HandoffRecord): boolean {
  return (
    isTerminalStatus(record.status) &&
    record.resolvedBy != null &&
    record.resolvedBy.length > 0 &&
    record.resolvedAt != null &&
    record.resolvedAt.length > 0
  );
}

/**
 * 制度系 handoff の対応ステータスを判定する
 */
export type RegulatoryResolutionStatus =
  | 'pending'         // 未対応 / 対応中
  | 'closed_no_trail' // 完了だが証跡なし（要対応）
  | 'resolved';       // 完了 + 証跡あり

export function getRegulatoryResolutionStatus(
  record: HandoffRecord,
): RegulatoryResolutionStatus {
  if (!isTerminalStatus(record.status)) return 'pending';
  if (hasResolutionTrail(record)) return 'resolved';
  return 'closed_no_trail';
}

// ─── 証跡セット生成 ─── //

export interface ResolutionTrailInput {
  resolvedBy: string;
  resolutionNote?: string;
}

/**
 * 対応完了時に handoff へ書き込むフィールドを生成する。
 * status も '対応済' に設定し、resolvedAt は現在時刻を自動付与。
 */
export function buildResolutionPayload(
  input: ResolutionTrailInput,
): Pick<HandoffRecord, 'status' | 'resolvedBy' | 'resolvedAt' | 'resolutionNote'> {
  return {
    status: '対応済',
    resolvedBy: input.resolvedBy,
    resolvedAt: new Date().toISOString(),
    resolutionNote: input.resolutionNote ?? '',
  };
}
