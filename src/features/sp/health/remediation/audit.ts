/**
 * Remediation Audit — 判断と実行の履歴を構造化して記録する
 *
 * 設計原則:
 * - 「何を判断したか」と「何を実行したか」の両方を残す
 * - plan 生成と execution 完了を同一の audit entry に統合する
 * - EventBus パターンで永続化層と疎結合（Repository が subscribe して保存）
 * - 再現性の担保: entry だけ見れば「なぜ・何を・いつ・誰が・結果は」が分かる
 */

import type {
  RemediationPlan,
  RemediationResult,
  RemediationActionType,
  RemediationRisk,
  RemediationSource,
} from './types';

// ── Audit Entry ──────────────────────────────────────────────────────────────

export type RemediationAuditPhase = 'planned' | 'executed' | 'skipped';

export interface RemediationAuditEntry {
  /** 実行相関ID（planId と同一または細分化されたID） */
  correlationId: string;
  /** plan.id と対応 */
  planId: string;

  /** 監査フェーズ: planned=判断記録、executed=実行記録 */
  phase: RemediationAuditPhase;

  /** 修復対象の種別 */
  targetType: import('./types').RemediationTargetType;
  /** 対象リスト */
  listKey: string;
  /** 対象フィールド */
  fieldName: string;

  /** 実行アクション */
  action: RemediationActionType;
  /** 判断時のリスク評価 */
  risk: RemediationRisk;
  /** 自動実行可否の判定結果 */
  autoExecutable: boolean;
  /** 承認要否の判定結果 */
  requiresApproval: boolean;

  /** 人間が読める理由 */
  reason: string;
  /** 生成元 */
  source: RemediationSource;

  /** 実行結果（phase=executed のときのみ） */
  executionStatus?: RemediationResult['status'];
  /** エラー詳細（phase=executed かつ失敗時のみ） */
  executionError?: RemediationResult['error'];

  /** 自動実行をスキップした理由（phase=skipped のみ） */
  skippedReason?: string;

  /** 記録日時（ISO 8601） */
  timestamp: string;
}

// ── EventBus ─────────────────────────────────────────────────────────────────

type AuditListener = (entry: RemediationAuditEntry) => void;

class RemediationAuditBus {
  private listeners: AuditListener[] = [];

  emit(entry: RemediationAuditEntry): void {
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // fail-open: リスナーの例外で audit 自体を止めない
      }
    }
  }

  subscribe(listener: AuditListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** @internal テスト用 */
  _reset(): void {
    this.listeners = [];
  }
}

export const remediationAuditBus = new RemediationAuditBus();

// ── Emit helpers ─────────────────────────────────────────────────────────────

/**
 * plan 生成時の判断記録を発火する
 *
 * planner 自体は純粋関数のまま保つため、
 * planner の呼び出し元がこの関数を呼ぶ。
 */
export function emitPlanCreated(plan: RemediationPlan): void {
  remediationAuditBus.emit({
    correlationId: plan.id,
    planId: plan.id,
    phase: 'planned',
    targetType: plan.target.type,
    listKey: plan.target.listKey ?? '',
    fieldName: plan.target.fieldName ?? '',
    action: plan.action,
    risk: plan.risk,
    autoExecutable: plan.autoExecutable,
    requiresApproval: plan.requiresApproval,
    reason: plan.reason,
    source: plan.source,
    timestamp: plan.createdAt,
  });
}

/**
 * plan 実行完了時の実行記録を発火する
 */
export function emitExecutionCompleted(plan: RemediationPlan, result: RemediationResult): void {
  remediationAuditBus.emit({
    correlationId: plan.id,
    planId: plan.id,
    phase: 'executed',
    targetType: plan.target.type,
    listKey: plan.target.listKey ?? '',
    fieldName: plan.target.fieldName ?? '',
    action: plan.action,
    risk: plan.risk,
    autoExecutable: plan.autoExecutable,
    requiresApproval: plan.requiresApproval,
    reason: plan.reason,
    source: plan.source,
    executionStatus: result.status,
    executionError: result.error,
    timestamp: result.executedAt,
  });
}
/**
 * 修復をスキップした際の判断記録を発火する
 */
export function emitActionSkipped(plan: RemediationPlan, reason: string): void {
  remediationAuditBus.emit({
    correlationId: plan.id,
    planId: plan.id,
    phase: 'skipped',
    targetType: plan.target.type,
    listKey: plan.target.listKey ?? '',
    fieldName: plan.target.fieldName ?? '',
    action: plan.action,
    risk: plan.risk,
    autoExecutable: plan.autoExecutable,
    requiresApproval: plan.requiresApproval,
    reason: plan.reason,
    source: plan.source,
    skippedReason: reason,
    timestamp: new Date().toISOString(),
  });
}
