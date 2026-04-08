import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceAuditStore } from '../governanceAuditStore';

describe('Governance Policy Review Simulation (Human-in-the-loop)', () => {
  let store: GovernanceAuditStore;

  beforeEach(() => {
    store = GovernanceAuditStore.getInstance();
    (store as any).entries = []; 
  });

  const generateMockAuditData = () => {
    // 10件の推薦を生成
    for (let i = 1; i <= 10; i++) {
      store.logDecision({
        recommendationId: `rec-${i}`,
        reasonKey: `list-${i}:FieldA`,
        listKey: `list-${i}`,
        actionType: 'ensureField',
        recommendedAction: 'Fix field',
        confidence: i <= 5 ? 'high' : 'medium',     // 5件は高確信度
        autoExecutable: i <= 3,                    // 3件は自動実行対象
        priorityScore: 10,
        priorityLevel: 'P1_CRITICAL',
        status: 'dry_run_passed',
        simulatedResult: 'passed'
      });
    }
  };

  it('人間レビューの結果を反映し、Quality Gates (しきい値) の突破判定ができること', () => {
    generateMockAuditData();
    
    // 人間によるレビュー結果の入力 (Mock)
    // 1-8件目: 承認 (accepted)
    // 9件目: 微修正 (modified)
    // 10件目: 無視 (ignored)
    for (let i = 1; i <= 10; i++) {
        const decision = i <= 8 ? 'executed' : (i === 9 ? 'modified' : 'ignored');
        store.updateDecision(`rec-${i}`, decision);
    }

    const report = store.getAnalysisReport();

    console.log('--- Policy Review Analysis Report ---');
    console.log(`Accepted Rate: ${report.acceptedRate}%`);
    console.log(`High Confidence Accepted Rate: ${report.highConfidenceAcceptedRate}%`);
    console.log(`Auto Executable Accepted Rate: ${report.autoExecutableAcceptedRate}%`);

    // 受入基準の検証
    expect(report.acceptedRate).toBe(80); // 8/10
    expect(report.highConfidenceAcceptedRate).toBe(100); // 5/5
    expect(report.autoExecutableAcceptedRate).toBe(100); // 3/3

    // 結論: この知能は Quality Gates を突破している
    expect(report.autoExecutableAcceptedRate).toBeGreaterThanOrEqual(95);
  });
});
