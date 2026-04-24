/**
 * Orchestrator Failure Taxonomy
 * 業務エラーの分類定義。
 */
export enum OrchestratorFailureKind {
  CONFLICT = 'CONFLICT',         // ETag 競合、同時編集
  VALIDATION = 'VALIDATION',     // ビジネスルール違反
  AUTHORIZATION = 'AUTHORIZATION', // 権限不足
  NETWORK = 'NETWORK',           // 通信失敗、タイムアウト
  SCHEMA_DRIFT = 'SCHEMA_DRIFT', // SharePoint 側の物理スキーマ不整合
  UNKNOWN = 'UNKNOWN',           // 未分類のエラー
}

/**
 * Audit Log Entry
 * 監査ログの構造。
 */
export interface AuditLogEntry {
  action: string;                // 例: 'UPDATE_USER_PROFILE'
  actor?: string;                // 実行ユーザー (Email等)
  targetId: string | number;     // 操作対象のID
  status: 'SUCCESS' | 'FAILURE';
  durationMs: number;            // 処理時間
  metadata?: Record<string, unknown>; // 補足情報 (変更フィールド等)
  error?: {
    kind: OrchestratorFailureKind;
    message: string;
    stack?: string;
  };
}

/**
 * FailureKind ごとの推奨アクション定義
 */
export const FAILURE_ACTION_MAP: Record<OrchestratorFailureKind, string> = {
  [OrchestratorFailureKind.CONFLICT]: 'ページを再読み込みして、最新のデータで再度実行してください。',
  [OrchestratorFailureKind.VALIDATION]: '入力内容に不備があります。エラー詳細を確認して修正してください。',
  [OrchestratorFailureKind.AUTHORIZATION]: 'この操作を実行する権限がありません。管理者へお問い合わせください。',
  [OrchestratorFailureKind.NETWORK]: 'ネットワーク接続を確認し、しばらく待ってから再試行してください。',
  [OrchestratorFailureKind.SCHEMA_DRIFT]: 'システム設定に不整合があります。システム管理者へ報告してください。',
  [OrchestratorFailureKind.UNKNOWN]: '予期せぬエラーが発生しました。ログを確認し、必要に応じて開発者へ報告してください。'
};

/**
 * 監査ログのインメモリバッファ（最新 100 件程度を保持）
 */
const AUDIT_BUFFER: AuditLogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * テレメトリ記録用ユーティリティ
 */
export const recordAudit = (entry: AuditLogEntry) => {
  const timestamp = new Date().toISOString();
  
  // バッファに追加
  AUDIT_BUFFER.unshift({ ...entry });
  if (AUDIT_BUFFER.length > MAX_BUFFER_SIZE) {
    AUDIT_BUFFER.pop();
  }

  const logPrefix = `[AUDIT][${timestamp}][${entry.status}] ${entry.action}`;
  
  if (entry.status === 'SUCCESS') {
    console.info(`${logPrefix} on ${entry.targetId} (${entry.durationMs}ms)`, entry.metadata);
  } else {
    const actionHint = FAILURE_ACTION_MAP[entry.error?.kind || OrchestratorFailureKind.UNKNOWN];
    console.warn(`${logPrefix} on ${entry.targetId} FAILED: ${entry.error?.kind} - ${entry.error?.message}. Hint: ${actionHint}`, {
      durationMs: entry.durationMs,
      metadata: entry.metadata,
      stack: entry.error?.stack
    });
  }
};

/**
 * 最新の監査ログを取得
 */
export const getRecentAuditLogs = () => [...AUDIT_BUFFER];

/**
 * オーケストレーター健康スコアの算出
 */
export const getOrchestratorHealthScore = () => {
  if (AUDIT_BUFFER.length === 0) return { score: 100, status: 'N/A' };

  const successCount = AUDIT_BUFFER.filter(e => e.status === 'SUCCESS').length;
  const successRate = (successCount / AUDIT_BUFFER.length) * 100;
  
  // スコア計算（成功率重視）
  let score = successRate;
  
  // 遅延ペナルティ (500ms超えが10%以上あれば減点)
  const slowCount = AUDIT_BUFFER.filter(e => (e.durationMs || 0) > 500).length;
  if (slowCount / AUDIT_BUFFER.length > 0.1) {
    score -= 5;
  }

  const status = score >= 95 ? 'Excellent' : score >= 80 ? 'Stable' : score >= 60 ? 'Warning' : 'Critical';

  return {
    score: Math.round(score),
    status,
    successRate: Math.round(successRate * 10) / 10,
    totalCount: AUDIT_BUFFER.length
  };
};

/**
 * 失敗統計の集計
 */
export const getAuditFailureSummary = () => {
  const failures = AUDIT_BUFFER.filter(e => e.status === 'FAILURE');
  const countsByKind: Record<string, number> = {};
  const countsByAction: Record<string, number> = {};
  
  failures.forEach(f => {
    const kind = f.error?.kind || OrchestratorFailureKind.UNKNOWN;
    countsByKind[kind] = (countsByKind[kind] || 0) + 1;
    countsByAction[f.action] = (countsByAction[f.action] || 0) + 1;
  });
  
  // 頻出失敗ランキング
  const topFailureActions = Object.entries(countsByAction)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  return {
    totalFailures: failures.length,
    byKind: countsByKind,
    topFailureActions,
    latestFailures: failures.slice(0, 5).map(f => ({
      ...f,
      suggestedAction: FAILURE_ACTION_MAP[f.error?.kind || OrchestratorFailureKind.UNKNOWN]
    }))
  };
};
