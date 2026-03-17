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
// TimelineSourceRef — ソースレコードへの参照（判別可能 union）
// ─────────────────────────────────────────────

/**
 * タイムラインイベントからソース詳細画面へのナビゲーション情報。
 *
 * 判別可能 union（discriminated union）にすることで、
 * UI 側の遷移分岐を型安全に行える。
 */
export type TimelineSourceRef =
  | { readonly source: 'daily'; readonly date: string; readonly recordId?: string | number }
  | { readonly source: 'incident'; readonly incidentId: string }
  | { readonly source: 'isp'; readonly ispId: string }
  | { readonly source: 'handoff'; readonly handoffId: number };

/**
 * TimelineSourceRef からアプリ内パスを生成する。
 *
 * 遷移先が存在しない場合は null を返す。
 */
export function resolveSourceRefPath(ref: TimelineSourceRef): string | null {
  switch (ref.source) {
    case 'daily':
      return `/daily/table`;
    case 'incident':
      return `/incidents?incidentId=${encodeURIComponent(ref.incidentId)}`;
    case 'isp':
      return `/support-plan-guide`;
    case 'handoff':
      return `/handoff-timeline`;
    default:
      return null;
  }
}

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
 * - sourceRef: ソース詳細画面へのナビゲーション情報
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
  /** ソースレコードへの参照情報（ナビゲーション用） */
  readonly sourceRef: TimelineSourceRef;
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
// TimelineRangePreset — 期間プリセット
// ─────────────────────────────────────────────

/** 期間プリセットのキー */
export type TimelineRangePresetKey = '7d' | '30d' | '90d';

/** 期間プリセット定義 */
export type TimelineRangePreset = {
  readonly key: TimelineRangePresetKey;
  readonly label: string;
  readonly days: number;
};

/** 利用可能な期間プリセット */
export const TIMELINE_RANGE_PRESETS: readonly TimelineRangePreset[] = [
  { key: '7d', label: '7日', days: 7 },
  { key: '30d', label: '30日', days: 30 },
  { key: '90d', label: '90日', days: 90 },
] as const;

/** デフォルトの期間プリセット */
export const DEFAULT_RANGE_PRESET: TimelineRangePresetKey = '30d';

/**
 * 期間プリセットから from/to 文字列を計算する。
 *
 * @param presetKey - プリセットキー
 * @param now - 基準日時（テスト注入用、省略時は現在日時）
 * @returns { from, to } — ISO 8601 日付文字列
 */
export function computeRangeFilter(
  presetKey: TimelineRangePresetKey,
  now: Date = new Date(),
): { from: string; to: string } {
  const preset = TIMELINE_RANGE_PRESETS.find((p) => p.key === presetKey);
  const days = preset?.days ?? 30;

  const to = now.toISOString();

  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  fromDate.setHours(0, 0, 0, 0);
  const from = fromDate.toISOString();

  return { from, to };
}

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

