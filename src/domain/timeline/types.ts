/**
 * Timeline Domain — 共通型定義
 *
 * 4ドメイン（Daily / Incident / ISP / Handoff）を userId 軸で
 * 時系列に統合するための共通表示モデル。
 *
 * 設計方針:
 *   - TimelineEvent: 全ドメインの差異を吸収した統一イベント型
 *   - TimelineFilter: ソース種別・期間・重要度によるフィルタ
 *   - Pure types only — ランタイムロジックを含まない
 *
 * @see docs/architecture/user_timeline_architecture.md
 */

// ─────────────────────────────────────────────
// イベントソース種別
// ─────────────────────────────────────────────

/** タイムラインイベントの発生元ドメイン */
export type TimelineEventSource = 'daily' | 'incident' | 'isp' | 'handoff';

/** 全ソース種別（フィルタ UI 等で使用） */
export const TIMELINE_SOURCES: readonly TimelineEventSource[] = [
  'daily',
  'incident',
  'isp',
  'handoff',
] as const;

/** ソース種別の日本語ラベル */
export const TIMELINE_SOURCE_LABELS: Record<TimelineEventSource, string> = {
  daily: '日次記録',
  incident: 'インシデント',
  isp: '個別支援計画',
  handoff: '申し送り',
} as const;

// ─────────────────────────────────────────────
// 重要度
// ─────────────────────────────────────────────

/** 重要度の統一3段階表現 */
export type TimelineSeverity = 'info' | 'warning' | 'critical';

// ─────────────────────────────────────────────
// TimelineEvent — 統一イベント
// ─────────────────────────────────────────────

/**
 * 4ドメインの差異を吸収した統一タイムラインイベント。
 *
 * 各 adapter が元ドメインモデルからこの型に変換する。
 * - id: "daily-123", "incident-abc" のような一意キー
 * - occurredAt: ソートキー（ISO 8601）
 * - severity: 3段階に正規化
 */
export type TimelineEvent = {
  /** イベント一意キー（"daily-123", "incident-abc" 等） */
  readonly id: string;
  /** ソースドメイン */
  readonly source: TimelineEventSource;
  /** 対象利用者 ID */
  readonly userId: string;
  /** イベント発生日時（ISO 8601） — ソートキー */
  readonly occurredAt: string;
  /** 表示タイトル（1行） */
  readonly title: string;
  /** 補足テキスト（省略可能） */
  readonly description?: string;
  /** 統一された重要度 */
  readonly severity: TimelineSeverity;
  /** ソースレコードへの参照情報 */
  readonly sourceRef: {
    /** ソースレコードの ID */
    readonly id: string | number;
    /** 画面遷移用パス（省略可能） */
    readonly path?: string;
  };
  /** ドメイン固有のメタデータ（チップ表示等） */
  readonly meta?: Record<string, string | number | boolean>;
};

// ─────────────────────────────────────────────
// TimelineFilter — 絞り込み
// ─────────────────────────────────────────────

/** タイムライン絞り込み条件 */
export type TimelineFilter = {
  /** 表示するソース種別（省略時: 全ソース） */
  sources?: TimelineEventSource[];
  /** 期間（開始、ISO 8601） */
  from?: string;
  /** 期間（終了、ISO 8601） */
  to?: string;
  /** 重要度フィルタ（指定以上のみ表示） */
  severity?: TimelineSeverity;
};

// ─────────────────────────────────────────────
// ResolveUserIdFromCode — Handoff 用
// ─────────────────────────────────────────────

/**
 * Handoff の userCode → userId 変換関数。
 *
 * 同一値の環境では identity ((code) => code) を渡す。
 * 値が異なる環境では UserMaster ルックアップを渡す。
 * null を返した場合、そのイベントはタイムラインから除外される。
 */
export type ResolveUserIdFromCode = (userCode: string) => string | null;
