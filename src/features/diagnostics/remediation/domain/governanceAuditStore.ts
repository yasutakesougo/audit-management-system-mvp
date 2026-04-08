/**
 * Governance Audit Storage — 監査ログの永続化と分析のための基盤
 */

import { type GovernanceAuditEntry } from './governanceAudit';

/**
 * SharePoint 保存用スキーマ定数
 * 監査ログリストの物理列名を定義（将来的な SP リスト作成用）
 */
export const AUDIT_LOG_LIST_SCHEMA = {
  TITLE: 'GovernanceAuditLogs',
  FIELDS: {
    RecommendationId: 'RecommendationId', // テキスト
    ReasonKey: 'ReasonKey',               // テキスト
    Confidence: 'Confidence',             // 選択肢 (high/medium/low)
    Auto: 'AutoExecutable',               // はい/いいえ
    Priority: 'PriorityScore',            // 数値
    Action: 'RecommendedAction',          // テキスト
    Decision: 'OperatorDecision',         // 選択肢 (executed/ignored/modified)
    Result: 'SimulatedResult',            // 選択肢 (passed/failed)
    Payload: 'MetadataPayload',           // 複数行テキスト (JSON)
  }
} as const;

/**
 * 監査ストアの責務:
 * 1. リアルシグナルによる Dry-run 結果を収集
 * 2. 人間のフィードバックを紐づけて永続化
 * 3. 学習用データの提供
 */
export class GovernanceAuditStore {
  private static instance: GovernanceAuditStore;
  private entries: GovernanceAuditEntry[] = [];

  static getInstance() {
    if (!this.instance) this.instance = new GovernanceAuditStore();
    return this.instance;
  }

  /**
   * 判断のスナップショットを記録
   */
  logDecision(entry: Omit<GovernanceAuditEntry, 'id' | 'timestamp'>) {
    const fullEntry: GovernanceAuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    
    this.entries.unshift(fullEntry);
    // [Audit LOG] Decision context captured
    return fullEntry.id;
  }

  /**
   * フィードバック（人間の判断）を更新
   */
  recordFeedback(id: string, decision: GovernanceAuditEntry['operatorDecision']) {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.operatorDecision = decision;
      entry.status = decision === 'executed' ? 'executed' : 
                     decision === 'ignored' ? 'ignored' : 'modified';
      // [Audit LOG] Operator decision updated
    }
  }

  getAll() {
    return this.entries;
  }

  /**
   * 監査結果を分析（司令塔のための事実データ: 8つの集計軸）
   */
  getAnalysisReport() {
    const total = this.entries.length;
    
    // Decisions
    const accepted = this.entries.filter(e => e.operatorDecision === 'executed');
    const ignored = this.entries.filter(e => e.operatorDecision === 'ignored');
    const modified = this.entries.filter(e => e.operatorDecision === 'modified');

    const highConfidenceEntries = this.entries.filter(e => e.confidence === 'high');
    const autoExecutableEntries = this.entries.filter(e => e.autoExecutable);

    // 1-3. Rates
    const acceptedRate = total > 0 ? (accepted.length / total) * 100 : 0;
    const ignoredRate = total > 0 ? (ignored.length / total) * 100 : 0;
    const modifiedRate = total > 0 ? (modified.length / total) * 100 : 0;

    // 4. Quality Gates (The "Shikiichi")
    const highConfidenceAcceptedRate = highConfidenceEntries.length > 0 
      ? (highConfidenceEntries.filter(e => e.operatorDecision === 'executed').length / highConfidenceEntries.length) * 100 
      : 0;

    const autoExecutableAcceptedRate = autoExecutableEntries.length > 0 
      ? (autoExecutableEntries.filter(e => e.operatorDecision === 'executed').length / autoExecutableEntries.length) * 100 
      : 0;

    // 5. Distribution by ReasonKey
    const byReasonKey = this.entries.reduce((acc, e) => {
      acc[e.reasonKey] = (acc[e.reasonKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 6. Distribution by Priority
    const byPriorityLevel = this.entries.reduce((acc, e) => {
      acc[e.priorityLevel] = (acc[e.priorityLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      // Counts
      totalRecommendations: total,
      highConfidenceCount: highConfidenceEntries.length,
      autoExecutableCount: autoExecutableEntries.length,
      
      // Rates & Quality Gates
      acceptedRate,
      ignoredRate,
      modifiedRate,
      highConfidenceAcceptedRate,
      autoExecutableAcceptedRate,
      
      // Distributions
      byReasonKey,
      byPriorityLevel,
      
      noiseSnapshot: {
        duplicateKeys: this.findDuplicates().length
      }
    };
  }

  private findDuplicates(): string[] {
    const keys = this.entries.map(e => e.reasonKey);
    return keys.filter((item, index) => keys.indexOf(item) !== index);
  }

  /**
   * 自動化の「確実さ」を算出（学習用メトリクス）
   */
  getAutomationMetrics() {
    const autoExecs = this.entries.filter(e => e.autoExecutable);
    const total = autoExecs.length;
    const accepted = autoExecs.filter(e => e.operatorDecision === 'executed').length;
    
    return {
      totalAutoRecommended: total,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      mistrustRate: total > 0 ? ((total - accepted) / total) * 100 : 0
    };
  }

  /**
   * 推薦に対する人間の最終判断を記録（フィードバック・ループ）
   */
  updateDecision(recommendationId: string, decision: 'executed' | 'ignored' | 'modified', comment?: string) {
    const entry = this.entries.find(e => e.recommendationId === recommendationId);
    if (entry) {
      entry.operatorDecision = decision;
      if (comment) {
        entry.operatorComment = comment;
      }
    }
  }

  /**
   * 監査ログをクリア（テスト用/メンテナンス用）
   */
  clear() {
    this.entries = [];
  }
}
