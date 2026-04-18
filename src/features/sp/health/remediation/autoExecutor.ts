/**
 * Guarded Auto Executor — 統治ルールに基づいた限定的な自動修復実行
 */

import type { RemediationPlan, RemediationResult, RemediationRisk } from './types';
import type { RemediationAuditEntry } from './audit';
import { calculateRemediationMetrics } from './metrics';
import { assessSLOCompliance } from './policy';
import { emitExecutionCompleted } from './audit';

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

    // 2. SLO 遵守状況による停止判定 (Kill-Switch)
    if (!compliance.autoRemediationAllowed) {
      return { 
        executedCount: 0, 
        results: [], 
        skippedReason: `SLO BREACHED: ${compliance.violations.join(', ')}` 
      };
    }

    // 3. 本日の実行済み件数をチェック（流量制限）
    const today = new Date().toISOString().split('T')[0];
    const executedTodayCount = entries.filter(e => 
      e.phase === 'executed' && 
      e.source === 'nightly_patrol' && // 自動実行分のみカウント
      e.timestamp.startsWith(today)
    ).length;

    if (executedTodayCount >= this.config.maxExecutionsPerDay) {
      return { 
        executedCount: 0, 
        results: [], 
        skippedReason: `Daily limit reached: ${executedTodayCount}/${this.config.maxExecutionsPerDay}` 
      };
    }

    // 4. バックログから自動実行対象を抽出
    // planned があり、executed がないものを探す
    const lifecycles = new Map<string, { planned?: RemediationAuditEntry; executed?: RemediationAuditEntry }>();
    for (const e of entries) {
      const id = e.correlationId;
      const existing = lifecycles.get(id) || {};
      if (e.phase === 'planned') existing.planned = e;
      if (e.phase === 'executed') existing.executed = e;
      lifecycles.set(id, existing);
    }

    const targets = Array.from(lifecycles.values())
      .filter(l => l.planned && !l.executed)
      .map(l => l.planned!)
      .filter(p => 
        p.autoExecutable && 
        this.config.allowedRisks.includes(p.risk as RemediationRisk)
      );

    if (targets.length === 0) {
      return { executedCount: 0, results: [] };
    }

    const results: RemediationResult[] = [];
    let remainingQuota = this.config.maxExecutionsPerDay - executedTodayCount;

    // 5. 実行ループ
    for (const planned of targets) {
      if (remainingQuota <= 0) break;

      // エントリから Plan オブジェクトを擬似再構成（実際にはリポジトリに Plan 保存が必要だが、型を合わせる）
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

      try {
        // eslint-disable-next-line no-console
        console.log(`🤖 Auto-executing remediation: ${plan.id} (${plan.action})`);
        const result = await this.executor(plan);
        results.push(result);
        
        // 監査ログに実行結果を記録 (AuditBus 経由で Repository が拾うことを期待)
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
