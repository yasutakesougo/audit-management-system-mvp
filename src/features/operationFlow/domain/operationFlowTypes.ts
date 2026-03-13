/**
 * OperationFlow — 福祉事業所の1日を9つの業務フェーズに分割する設定ベース型定義
 *
 * 目的:
 *   - 既存 OperationalPhase（6分割・コード固定）の発展形
 *   - フェーズ定義を「設定配列」で管理し、将来的に SharePoint 等から
 *     施設ごとの時間境界を読み込めるようにする
 *
 * 設計方針:
 *   - 既存 OperationalPhase を破壊しない（共存レイヤー）
 *   - 純粋型＋純粋関数のみ。UI・インフラ依存なし
 */

// ────────────────────────────────────────
// フェーズキー（9分割）
// ────────────────────────────────────────

/**
 * 9分割の業務フェーズキー
 *
 * 旧6分割との対応:
 *   preparation     → staff_prep
 *   morning-meeting → morning_briefing
 *   am-operation    → arrival_intake + am_activity
 *   pm-operation    → pm_activity
 *   evening-closing → departure_support
 *   record-review   → record_wrapup + evening_briefing + after_hours_review
 */
export type OperationFlowPhaseKey =
  | 'staff_prep'          // 常勤出勤・朝準備
  | 'morning_briefing'    // 朝会
  | 'arrival_intake'      // 通所受入
  | 'am_activity'         // 午前活動
  | 'pm_activity'         // 午後活動
  | 'departure_support'   // 退所対応
  | 'record_wrapup'       // 記録仕上げ
  | 'evening_briefing'    // 夕会
  | 'after_hours_review'; // 振り返り・翌日準備

// ────────────────────────────────────────
// 主役画面
// ────────────────────────────────────────

/** フェーズごとにサジェストされる主画面 */
export type PrimaryScreen =
  | '/today'
  | '/daily'
  | '/daily/attendance'
  | '/handoff-timeline'
  | '/dashboard';

// ────────────────────────────────────────
// フェーズ設定
// ────────────────────────────────────────

/**
 * 1フェーズの設定定義
 *
 * startTime / endTime は "HH:mm" 形式の文字列。
 * 比較時には分単位整数に変換して使う。
 *
 * 日付またぎ（例: 18:00–08:29）は endTime < startTime で表現する。
 */
export interface OperationFlowPhaseConfig {
  /** フェーズの一意キー */
  readonly phaseKey: OperationFlowPhaseKey;

  /** 日本語ラベル */
  readonly label: string;

  /** 開始時刻 "HH:mm" 形式（この時刻を含む） */
  readonly startTime: string;

  /** 終了時刻 "HH:mm" 形式（この時刻を含まない — 次のフェーズの startTime と一致する） */
  readonly endTime: string;

  /** このフェーズで最も利用される画面 */
  readonly primaryScreen: PrimaryScreen;

  /** 表示順（0始まり、小さいほど先） */
  readonly sortOrder: number;
}
