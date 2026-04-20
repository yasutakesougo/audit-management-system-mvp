/**
 * Remediation SLO (Service Level Objectives) — 運用の品質目標
 */

import type { RemediationKPIs } from './metrics';

export interface RemediationSLO {
  /** 平均修復時間 (MTTR) の目標上限 (ms) - デフォルト 2時間 */
  mttrGoalMs: number;
  /** バックログ（未対応プラン）の許容上限数 */
  backlogLimitCount: number;
  /** 運用継続を許可するための最小成功率 (0.0 - 1.0) */
  successRateMin: number;
  /** SLO 判定を開始するための最小分母数（実行数） */
  minExecutedForSloCheck: number;
}

export const CURRENT_SLO: RemediationSLO = {
  mttrGoalMs: 120 * 60 * 1000, // 120分
  backlogLimitCount: 5,
  successRateMin: 0.8,         // 80%
  minExecutedForSloCheck: 3,
};

/**
 * SLO 遵守状況
 */
export interface SLOCompliance {
  status: 'compliant' | 'warning' | 'breached';
  violations: string[];
  autoRemediationAllowed: boolean;
}

/**
 * 現在の KPI を SLO に照らして遵守状況を判定する
 */
export function assessSLOCompliance(
  kpis: RemediationKPIs,
  slo: RemediationSLO = CURRENT_SLO
): SLOCompliance {
  const violations: string[] = [];
  let autoRemediationAllowed = true;

  // 1. MTTR チェック (Duration)
  if (kpis.meanTimeToRemediateMs !== null && kpis.meanTimeToRemediateMs > slo.mttrGoalMs) {
    const minutes = Math.floor(kpis.meanTimeToRemediateMs / 60000);
    violations.push(`MTTR SLO 逸脱: 現在 ${minutes}分 (目標 ${Math.floor(slo.mttrGoalMs / 60000)}分以内)`);
  }

  // 2. バックログチェック (Backlog Capacity)
  if (kpis.backlogCount > slo.backlogLimitCount) {
    violations.push(`バックログ容量超過: 現在 ${kpis.backlogCount}件 (許容 ${slo.backlogLimitCount}件)`);
  }

  // 3. 成功率チェック (Quality)
  if (kpis.totalExecuted >= slo.minExecutedForSloCheck) {
    if (kpis.successRate < slo.successRateMin) {
      violations.push(`修復品質 SLO 違反: 成功率 ${Math.round(kpis.successRate * 100)}% (目標 ${Math.round(slo.successRateMin * 100)}%以上)`);
      autoRemediationAllowed = false; // 品質不足時は自動化を停止
    }
  }

  // 総合判定
  let status: SLOCompliance['status'] = 'compliant';
  if (!autoRemediationAllowed) {
    status = 'breached'; // 致命的（キルスイッチ発動）
  } else if (violations.length > 0) {
    status = 'warning';   // 目標未達だが継続可能
  }

  return {
    status,
    violations,
    autoRemediationAllowed
  };
}
