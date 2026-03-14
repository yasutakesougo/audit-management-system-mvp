/**
 * dateFormat.ts — 共通日付フォーマットAPI（Phase 1）
 *
 * リポジトリ内に散在する 15+ 個の formatDate 系実装を段階的に統一するための
 * 共通基盤ライブラリ。Phase 1 では「用途が名前で分かる」関数セットを定義し、
 * テストで仕様を固定する。
 *
 * ## 設計方針
 * - input は DateInput (Date | string | number | null | undefined) を統一的に受ける
 * - invalid な入力には例外を投げず、フォールバック文字列を返す
 * - timezone は JST (Asia/Tokyo) を前提。明示的な TZ 引数は設けない
 *   (TZ 付き変換は lib/mappers/schedule.ts の formatDateTimeInZone が担当)
 * - SharePoint / domain / billing 固有ロジックを含めない
 * - 既存の formatRangeLocal (utils/datetime.ts) とは共存する（あちらは範囲表示専用）
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 日付フォーマット関数が受け付ける入力型 */
export type DateInput = Date | string | number | null | undefined;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * DateInput を安全に Date オブジェクトに変換する。
 * invalid / null / undefined の場合は null を返す。
 */
function toSafeDate(input: DateInput): Date | null {
  if (input == null) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 日付を YYYY/MM/DD 形式にフォーマットする。
 *
 * 用途: 日付のみの表示（時刻不要）。帳票の日付欄、契約日表示など。
 *
 * @example
 * formatDateYmd(new Date(2025, 0, 15)) // => "2025/01/15"
 * formatDateYmd("2025-01-15T09:30:00Z") // => "2025/01/15" (ローカルTZ依存)
 * formatDateYmd(null) // => ""
 * formatDateYmd(null, '-') // => "-"
 */
export function formatDateYmd(input: DateInput, fallback: string = ''): string {
  const d = toSafeDate(input);
  if (!d) return fallback;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/**
 * 日付を日本語形式 YYYY年MM月DD日 にフォーマットする。
 *
 * 用途: UI上の日本語表示、利用者詳細画面、計画書の日付表記。
 *
 * @example
 * formatDateJapanese(new Date(2025, 0, 15)) // => "2025年1月15日"
 * formatDateJapanese(null) // => ""
 * formatDateJapanese(null, '未設定') // => "未設定"
 */
export function formatDateJapanese(input: DateInput, fallback: string = ''): string {
  const d = toSafeDate(input);
  if (!d) return fallback;

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}

/**
 * 日時を YYYY/MM/DD HH:mm 形式にフォーマットする。
 *
 * 用途: 作成日時・更新日時の表示、監査ログのタイムスタンプ表示。
 *
 * @example
 * formatDateTimeYmdHm(new Date(2025, 0, 15, 9, 30)) // => "2025/01/15 09:30"
 * formatDateTimeYmdHm("2025-01-15T09:30:00") // => "2025/01/15 09:30"
 * formatDateTimeYmdHm(null) // => ""
 */
export function formatDateTimeYmdHm(input: DateInput, fallback: string = ''): string {
  const d = toSafeDate(input);
  if (!d) return fallback;

  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${h}:${min}`;
}

/**
 * 日時を Intl.DateTimeFormat (ja-JP) でフォーマットする。
 *
 * 用途: ブラウザ依存の自然な日本語表記が必要な場合。
 * `toLocaleDateString('ja-JP', ...)` の散在を集約する。
 *
 * @example
 * formatDateTimeIntl(new Date(2025, 0, 15, 9, 30))
 * // => "2025/01/15 09:30" (ブラウザ/locale依存)
 */
export function formatDateTimeIntl(
  input: DateInput,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = '',
): string {
  const d = toSafeDate(input);
  if (!d) return fallback;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Intl.DateTimeFormat('ja-JP', options ?? defaultOptions).format(d);
}

/**
 * 安全なフォーマット関数。任意のフォーマッターを受け取り、
 * invalid / null / undefined 入力を安全にハンドリングする。
 *
 * 用途: カスタムフォーマットが必要だが null-safety を共通化したい場合。
 *
 * @example
 * safeFormatDate(
 *   "2025-01-15",
 *   (d) => `${d.getFullYear()}年`,
 *   '—'
 * ) // => "2025年"
 *
 * safeFormatDate(null, (d) => d.toISOString(), '—') // => "—"
 */
export function safeFormatDate(
  input: DateInput,
  formatter: (date: Date) => string,
  fallback: string = '',
): string {
  const d = toSafeDate(input);
  if (!d) return fallback;

  try {
    return formatter(d);
  } catch {
    return fallback;
  }
}

/**
 * 日付を YYYY-MM-DD (ISO date) 形式にフォーマットする。
 * ローカルタイムゾーンの日付を返す（UTC ではない）。
 *
 * 用途: フォーム入力値、date input type の value、内部キーとしての日付文字列。
 *
 * ⚠️ Date.toISOString().slice(0,10) は UTC 基準のため JST では日付ズレが起きる。
 *    この関数はローカル TZ の年月日を返す。
 *
 * @example
 * formatDateIso(new Date(2025, 0, 15)) // => "2025-01-15"
 * formatDateIso(null) // => ""
 */
export function formatDateIso(input: DateInput, fallback: string = ''): string {
  const d = toSafeDate(input);
  if (!d) return fallback;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

/**
 * ISO 日付文字列を「たった今」「N分前」「N時間前」「N日前」に変換する。
 * 7日以上前は `fallbackOptions` に基づく `Intl.DateTimeFormat` 表示にフォールバック。
 *
 * @param iso - ISO 8601 日付文字列
 * @param fallbackOptions - 7日超時の表示オプション (default: `{ month: 'short', day: 'numeric' }`)
 * @param nowMs - テスト用に「現在時刻」を差し替え可能 (default: `Date.now()`)
 * @returns 相対時間文字列 or フォールバック表示
 */
export function formatRelativeTime(
  iso: string,
  fallbackOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  nowMs: number = Date.now(),
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso; // parse 失敗時は元の値

  const diffMs = nowMs - then;

  if (diffMs < 60_000) return 'たった今';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}分前`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}時間前`;
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)}日前`;

  return new Intl.DateTimeFormat('ja-JP', fallbackOptions).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

export { toSafeDate };
