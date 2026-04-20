/**
 * Guarded Auto Executor — 統治ルールに基づいた限定的な自動修復実行
 */

import type { RemediationPlan, RemediationResult, RemediationRisk } from './types';
import type { RemediationAuditEntry } from './audit';
import { calculateRemediationMetrics } from './metrics';
import { assessSLOCompliance } from './policy';
import { emitExecutionCompleted, emitActionSkipped } from './audit';

/** 自動実行の構成 */
export interface AutoExecutionConfig {
  /** 1日あたりの最大自動実行数 */
  maxExecutionsPerDay: number;
  /** 対象とするリスクレベル（デフォルトは safe のみ） */
  allowedRisks: RemediationRisk[];
}

export const DEFAULT_AUTO_CONFIG: AutoExecutionConfig = {
  maxExecutionsPerDay: 5,
  allowedRisks: ['safe'],
};

/**
 * 自動実行のコントローラー
 */
export class GuardedAutoExecutor {
  constructor(
    private repository: { 
      getEntries(): Promise<RemediationAuditEntry[]>;
      saveEntry(entry: RemediationAuditEntry): Promise<void>;
    },
    private executor: (plan: RemediationPlan) => Promise<RemediationResult>,
    private config: AutoExecutionConfig = DEFAULT_AUTO_CONFIG
  ) {}

  /**
   * 保留中のプランの中から、条件に合うものを自動実行する
   */
  async executeAvailablePlans(): Promise<{
    executedCount: number;
    results: RemediationResult[];
    skippedReason?: string;
  }> {
    // 1. 監査ログを取得して現状を把握
    const entries = await this.repository.getEntries();
    const metrics = calculateRemediationMetrics(entries);
    const compliance = assessSLOCompliance(metrics);

    // 2. 本日の実行済カウント (流量制限のため)
    const today = new Date().toISOString().split('T')[0];
    const executedTodayCount = entries.filter(e => 
      e.phase === 'executed' && 
      e.source === 'nightly_patrol' && 
      e.timestamp.startsWith(today)
    ).length;

    // 3. バックログから自動実行対象を抽出
    // planned があり、executed がないものを探す
    const lifecycles = new Map<string, { planned?: RemediationAuditEntry; executed?: RemediationAuditEntry }>();
    for (const e of entries) {
      const id = e.correlationId;
      const existing = lifecycles.get(id) || {};
      if (e.phase === 'planned') existing.planned = e;
      if (e.phase === 'executed') existing.executed = e;
      if (e.phase === 'skipped') existing.executed = e; // skipped も実行完了(済み)とみなす
      lifecycles.set(id, existing);
    }

    const availableTargets = Array.from(lifecycles.values())
      .filter(l => l.planned && !l.executed)
      .map(l => l.planned!)
      .filter(p => p.autoExecutable);

    // 流量制限チェック
    if (executedTodayCount >= this.config.maxExecutionsPerDay) {
      const reason = `Daily limit reached: ${executedTodayCount}/${this.config.maxExecutionsPerDay}`;

      // 待機中のものすべてにスキップ理由を記録
      for (const target of availableTargets) {
        const plan: RemediationPlan = {
          id: target.planId,
          action: target.action,
          risk: target.risk,
          target: { type: target.targetType, listKey: target.listKey, fieldName: target.fieldName },
          autoExecutable: target.autoExecutable,
          requiresApproval: target.requiresApproval,
          reason: target.reason,
          source: target.source,
          createdAt: target.timestamp,
        };
        emitActionSkipped(plan, reason);
      }

      return { executedCount: 0, results: [], skippedReason: reason };
    }

    // SLO 遵守状況による停止判定 (Kill-Switch)
    if (!compliance.autoRemediationAllowed) {
      const reason = `SLO BREACHED: ${compliance.violations.join(', ')}`;
      
      // スキップされた事実を記録に残す
      for (const target of availableTargets) {
        // 簡易 Plan 再構成
        const plan: RemediationPlan = {
          id: target.planId,
          action: target.action,
          risk: target.risk,
          target: { type: target.targetType, listKey: target.listKey, fieldName: target.fieldName },
          autoExecutable: target.autoExecutable,
          requiresApproval: target.requiresApproval,
          reason: target.reason,
          source: target.source,
          createdAt: target.timestamp,
        };
        emitActionSkipped(plan, reason);
      }

      return { executedCount: 0, results: [], skippedReason: reason };
    }

    // フィルター (リスクレベル制限)
    const targets = availableTargets.filter(p => 
      this.config.allowedRisks.includes(p.risk as RemediationRisk)
    );

    if (targets.length === 0) {
      return { executedCount: 0, results: [] };
    }

    const results: RemediationResult[] = [];
    let remainingQuota = this.config.maxExecutionsPerDay - executedTodayCount;

    // 5. 実行ループ
    for (const planned of targets) {
      // エントリから Plan オブジェクトを擬似再構成
      const plan: RemediationPlan = {
        id: planned.planId,
        action: planned.action,
        risk: planned.risk,
        target: { 
          type: planned.targetType,
          listKey: planned.listKey, 
          fieldName: planned.fieldName 
        },
        autoExecutable: planned.autoExecutable,
        requiresApproval: planned.requiresApproval,
        reason: planned.reason,
        source: planned.source,
        createdAt: planned.timestamp,
      };

      if (remainingQuota <= 0) {
        emitActionSkipped(plan, 'Queue stopped: daily execution quota reached.');
        continue;
      }

      try {
        // eslint-disable-next-line no-console
        console.log(`🤖 Auto-executing remediation: ${plan.id} (${plan.action})`);
        const result = await this.executor(plan);
        results.push(result);
        
        // 監査ログに実行記録
        emitExecutionCompleted(plan, result);
        
        remainingQuota--;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`❌ Auto-execution failed for ${plan.id}:`, err);
      }
    }

    return {
      executedCount: results.length,
      results
    };
  }
}
