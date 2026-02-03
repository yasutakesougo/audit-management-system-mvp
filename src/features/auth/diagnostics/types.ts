/**
 * Auth Diagnostics - Type Definitions
 * Phase 3.7-A: Auth診断基盤
 */

/**
 * Auth診断の理由コード（Phase 3.6で定義済みのものを再利用）
 */
export type AuthDiagnosticReason =
  | 'account-mismatch'           // アカウント不一致
  | 'login-failure'              // ログイン失敗
  | 'token-expired'              // トークン期限切れ
  | 'list-not-found'             // SharePointリスト未作成
  | 'list-check-pending'         // リストチェック長時間待ち
  | 'network-error'              // ネットワークエラー
  | 'popup-blocked'              // Popupブロック
  | 'unknown-error';             // 不明なエラー

/**
 * Auth診断イベントの結果
 */
export type AuthDiagnosticOutcome =
  | 'blocked'        // ブロックされた
  | 'recovered'      // 自己回復した
  | 'manual-fix';    // 手動修正が必要

/**
 * Auth診断イベント
 */
export interface AuthDiagnosticEvent {
  /** イベント発生時刻（ISO 8601） */
  timestamp: string;

  /** 発生した画面/ルート */
  route: string;

  /** 診断理由コード */
  reason: AuthDiagnosticReason;

  /** 結果 */
  outcome: AuthDiagnosticOutcome;

  /** 相関ID（トレース用） */
  correlationId: string;

  /** ユーザーID（取得できた場合） */
  userId?: string;

  /** 追加メタデータ */
  metadata?: Record<string, unknown>;
}

/**
 * Reason別の集計結果
 */
export interface AuthDiagnosticStats {
  /** Reason別のカウント */
  byReason: Record<AuthDiagnosticReason, number>;

  /** Outcome別のカウント */
  byOutcome: Record<AuthDiagnosticOutcome, number>;

  /** 自己回復率（0-1） */
  recoveryRate: number;

  /** 総イベント数 */
  totalEvents: number;

  /** ブロック件数 */
  blockedCount: number;
}
