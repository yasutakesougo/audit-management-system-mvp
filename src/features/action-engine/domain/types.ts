// ---------------------------------------------------------------------------
// Action Engine — Domain Types
//
// Bridge ③: Analysis → Action
// 分析結果から自動生成される修正提案の型定義。
// ---------------------------------------------------------------------------

/** 提案の種別 */
export type SuggestionType =
  | 'assessment_update'    // アセスメント見直し
  | 'plan_update'          // 支援計画修正
  | 'bip_strategy_update'  // BIP 戦略修正
  | 'new_bip_needed'       // 新 BIP 作成
  | 'data_collection';     // 追加データ収集

/** 提案の優先度 */
export type SuggestionPriority = 'P0' | 'P1' | 'P2';

/** 提案のエビデンス（根拠） */
export interface SuggestionEvidence {
  /** 判定に使用した指標名 */
  metric: string;
  /** 現在値 */
  currentValue: number | string;
  /** 閾値 */
  threshold: number | string;
  /** 計測期間 */
  period: string;
  /** 判定に使った生メトリクス（UI の「なぜ？」に答える） */
  metrics?: Record<string, number | string>;
  /** データの出自参照（ABCRecord ID, BIP ID 等） */
  sourceRefs?: string[];
}

/** CTA（Call To Action） */
export interface SuggestionCTA {
  /** ボタンラベル */
  label: string;
  /** 遷移先ルート */
  route: string;
  /** URL パラメータ */
  params?: Record<string, string>;
}

/**
 * ActionSuggestion — 修正提案
 *
 * Analysis Dashboard の分析結果から自動生成され、
 * Today / ExceptionCenter に表示される。
 */
export interface ActionSuggestion {
  /** 一意 ID（ランタイム生成、再計算で変わる） */
  id: string;
  /**
   * 安定 ID — dismiss / dedupe / telemetry 用。
   * `${ruleId}:${userId}:${weekBucket}` 形式。
   * 同じ週に同じルールが同じユーザーに対して生成した提案は同一 stableId を持つ。
   */
  stableId: string;
  /** 提案種別 */
  type: SuggestionType;
  /** 優先度 */
  priority: SuggestionPriority;
  /** 対象利用者 ID */
  targetUserId: string;
  /** 提案タイトル */
  title: string;
  /** 推奨理由 */
  reason: string;
  /** エビデンス */
  evidence: SuggestionEvidence;
  /** CTA */
  cta: SuggestionCTA;
  /** 生成日時 (ISO 8601) */
  createdAt: string;
  /** 有効期限 (ISO 8601) — 省略時は無期限 */
  expiresAt?: string;
  /** 検出ルール名（デバッグ用） */
  ruleId: string;
  /** 担当者ID (P2: チーム運用用) */
  assignedToUserId?: string;
  /** 通知実行日時 (P1: 重複通知防止用) */
  notifiedAt?: string;
}

// ---------------------------------------------------------------------------
// buildCorrectiveActions の入力型
// ---------------------------------------------------------------------------

/** 日別統計の要約 */
export interface TrendSummary {
  recentAvg: number;
  previousAvg: number;
  /** recent / previous の変化率 (1.0 = 変化なし, 1.3 = 30% 増) */
  changeRate: number;
}

/** 実施統計 */
export interface ExecutionSummary {
  completed: number;
  triggered: number;
  skipped: number;
  total: number;
  completionRate: number;
}

/** ヒートマップピーク情報 */
export interface HeatmapPeak {
  hour: number;
  count: number;
  totalEvents: number;
  /** ピーク時間帯の占有率 (0〜1) */
  concentration: number;
}

/** 高強度イベント */
export interface HighIntensityEvent {
  id: string;
  intensity: number;
  recordedAt: string;
}

/**
 * buildCorrectiveActions の入力。
 * ViewModel レイヤーで組み立て、純粋関数に渡す。
 */
export interface CorrectiveActionInput {
  targetUserId: string;
  /** 日別傾向 */
  trend: TrendSummary;
  /** 手順実施統計 */
  execution: ExecutionSummary;
  /** 高強度イベント (intensity >= 4, 直近 7 日) */
  highIntensityEvents: HighIntensityEvent[];
  /** ヒートマップのピーク */
  heatmapPeak: HeatmapPeak;
  /** アクティブ BIP 数 */
  activeBipCount: number;
  /** 期間内の総行動件数 */
  totalIncidents: number;
  /** 最終記録日 (ISO 8601) */
  lastRecordDate: string | null;
  /** 分析対象日数 */
  analysisDays: number;
}

// ---------------------------------------------------------------------------
// Dedupe / 安定 ID ユーティリティ
// ---------------------------------------------------------------------------

/** ISO 週バケット (YYYY-Www) を生成 */
export function toWeekBucket(date: Date): string {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86_400_000) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/** ルール + ユーザー + 週バケットから安定 ID を生成 */
export function buildStableId(ruleId: string, userId: string, date: Date): string {
  return `${ruleId}:${userId}:${toWeekBucket(date)}`;
}

/** CTA.route で dedupe キーを生成 */
export function dedupeKey(suggestion: ActionSuggestion): string {
  return `${suggestion.targetUserId}:${suggestion.cta.route}`;
}

/**
 * 最大表示件数（同一ユーザーあたり）
 * Today / ExceptionCenter 表示時の上限
 */
export const MAX_SUGGESTIONS_PER_USER = 5;

// ---------------------------------------------------------------------------
// ActionSuggestionState — 提案への人の判断状態
//
// 【重要な設計判断】
// ActionSuggestion（検知結果）と ActionSuggestionState（人の判断）を分離。
// - ActionSuggestion は毎回再計算される「検知の出力」
// - ActionSuggestionState は人が明示的に行った操作の記録
// この分離により、dismiss した提案が再検知されたときの判定が明確になる。
// ---------------------------------------------------------------------------

/** 提案に対する人の判断ステータス */
export type SuggestionStatus = 'open' | 'dismissed' | 'snoozed' | 'done';

/**
 * ActionSuggestionState — 提案への人の操作状態。
 *
 * stableId をキーとして ActionSuggestion と紐付く。
 * 永続化レイヤーが決まるまではインメモリで運用可能。
 */
export interface ActionSuggestionState {
  /** ActionSuggestion の stableId と一致 */
  stableId: string;
  /** 現在のステータス */
  status: SuggestionStatus;
  /** snooze 解除日時 (ISO 8601) — status が 'snoozed' のときのみ有効 */
  snoozedUntil?: string;
  /** 最終更新日時 (ISO 8601) */
  updatedAt: string;
  /** 操作者 ID */
  updatedBy?: string;
  /** dismiss / snooze の理由（オプション） */
  reason?: string;
}

/**
 * 提案がフィルタ対象かどうかを判定する。
 * - dismissed → 非表示
 * - snoozed → snoozedUntil 以降なら再表示
 * - open → 表示
 */
export function isSuggestionVisible(
  state: ActionSuggestionState | undefined,
  now: Date,
): boolean {
  if (!state || state.status === 'open') return true;
  if (state.status === 'dismissed') return false;
  // snoozed: 解除時刻を過ぎていたら表示
  if (state.status === 'snoozed' && state.snoozedUntil) {
    return new Date(state.snoozedUntil).getTime() <= now.getTime();
  }
  return false;
}

// ---------------------------------------------------------------------------
// ActionTask — Persistent Execution Entity
// ---------------------------------------------------------------------------

/** タスクの実行ステータス */
export type ActionTaskStatus = 'open' | 'in_progress' | 'done' | 'dismissed';

/** 
 * ActionTask — 永続的な実行タスク 
 * Suggestion から昇格（Promote）された、または要修正として固定された実体。
 */
export interface ActionTask extends ActionSuggestion {
  /** 永続 ID (UUID) */
  taskId: string;
  /** 実行ステータス */
  status: ActionTaskStatus;
  /** 署名・承認者 ID */
  approvedBy?: string;
  /** 実施期限 (ISO 8601) */
  dueDate?: string;
  /** 実行完了日時 (ISO 8601) */
  executedAt?: string;
  /** 完了時のメモ・結果報告 */
  resultNote?: string;
  /** 関連するタイムラインのスナップショット ID（オプション） */
  timelineSnapshotId?: string;
}
