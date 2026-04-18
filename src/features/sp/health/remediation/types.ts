/**
 * RemediationPlan — 自己修復の「判断」を再現可能な契約として定義する
 *
 * 設計原則:
 * - risk（意味上の危険度）と autoExecutable（ポリシー上の実行可否）を絶対に混ぜない
 * - UI / Nightly Patrol / CI の全てが同じ型を共有する
 * - nullable より optional/undefined を優先（CONTRACT_RULES.md 整合）
 * - 監査に必要な最低限のメタデータを持つ
 */

// ── Target ───────────────────────────────────────────────────────────────────

/** 修復対象の種別 */
export type RemediationTargetType = 'index' | 'field' | 'list' | 'schema';

/** 修復対象の識別子 */
export interface RemediationTarget {
  type: RemediationTargetType;
  /** 対象リストのキー（KNOWN_REQUIRED_INDEXED_FIELDS のキーと対応） */
  listKey?: string;
  /** 対象フィールドの InternalName */
  fieldName?: string;
}

// ── Action ───────────────────────────────────────────────────────────────────

/** 修復アクションの種別 */
export type RemediationActionType =
  | 'delete_index'
  | 'create_index'
  | 'rename_field'
  | 'delete_field';

// ── Risk ─────────────────────────────────────────────────────────────────────

/**
 * 意味上の危険度（修復アクション自体のリスク）
 *
 * - safe: データ損失なし・副作用なし（例: 不要インデックス削除）
 * - moderate: 外部連携への影響がありえる（例: Power Automate 参照中のインデックス）
 * - dangerous: データ構造変更・不可逆操作を含む（例: フィールド削除）
 */
export type RemediationRisk = 'safe' | 'moderate' | 'dangerous';

// ── Source ────────────────────────────────────────────────────────────────────

/**
 * plan を生成したコンテキスト
 * - nightly_patrol: バッチ巡回
 * - realtime: リアルタイム検知
 * - manual: 管理者が手動で要求
 * - ci: CI/CD パイプライン
 */
export type RemediationSource = 'nightly_patrol' | 'realtime' | 'manual' | 'ci';

// ── Plan ─────────────────────────────────────────────────────────────────────

/**
 * 自己修復計画
 *
 * planner が生成し、executor が消費する。
 * 「何を」「なぜ」「どのリスクで」「自動実行してよいか」を1レコードに閉じ込める。
 */
export interface RemediationPlan {
  /** 一意識別子（UUID v4 等） */
  id: string;

  /** 修復対象 */
  target: RemediationTarget;

  /** 実行するアクション */
  action: RemediationActionType;

  /**
   * 意味上の危険度
   * 「このアクションが失敗したとき、どれくらい痛いか」
   */
  risk: RemediationRisk;

  /**
   * ポリシー上の自動実行可否
   * true = executor が承認なしで即実行してよい
   * false = UI または管理者の明示的承認が必要
   *
   * risk とは独立: safe でも autoExecutable=false のケースはある
   * （例: 本番環境ではすべて手動承認ポリシー）
   */
  autoExecutable: boolean;

  /**
   * 明示的な承認が必要かどうか
   * autoExecutable=false のとき通常 true だが、
   * ポリシー層が上書きできるように独立フラグとして持つ
   */
  requiresApproval: boolean;

  /** 人間が読める修復理由 */
  reason: string;

  /** plan を生成したコンテキスト */
  source: RemediationSource;

  /** plan 生成日時（ISO 8601） */
  createdAt: string;
}

// ── Execution Result ─────────────────────────────────────────────────────────

/** executor が返す実行結果 */
export interface RemediationResult {
  /** 実行した plan の id */
  planId: string;

  /** 実行結果 */
  status: 'success' | 'skipped' | 'error';

  /** エラー時の構造化情報 */
  error?: {
    code: string;
    message: string;
    /** リトライ可能かどうか */
    retryable: boolean;
  };

  /** 実行完了日時（ISO 8601） */
  executedAt: string;
}
