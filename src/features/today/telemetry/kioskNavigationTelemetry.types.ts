import type { KioskQuickLinkId } from '../model/getKioskQuickLinks';

/**
 * Kiosk UX Regression Tracking Events
 *
 * 現場で迷わない「1タップUX」と「必ず帰れる導線」を計測するための標準Telemetry定義。
 * UXの効果測定や、メニュー構成の迷いを検知（例: FABからの遷移多発）するために使用します。
 * 
 * イベント発火実装前に、まずイベント名とペイロードの「型契約」をここで固定します。
 */

export const KIOSK_TELEMETRY_EVENTS = {
  /** Todayダッシュボードから各機能への「最短1タップ」ナビゲート（成功体験ルート） */
  NAVIGATE_FROM_TODAY: 'ux_navigate_from_today',

  /** 各機能から「戻る」ボタンを用いてTodayへ帰還した（セーフティーネット利用実績） */
  RETURN_TO_TODAY: 'ux_return_to_today',

  /** 直感的なルートが見つからず、FABを長押しで開いた（フォールバックルートの利用率監視用） */
  OPEN_FAB_MENU: 'ux_open_fab_menu',

  /** 設定等からUIレイアウトをキオスクモードに切り替えた */
  KIOSK_MODE_ENABLED: 'ux_kiosk_mode_enabled',

  /** キオスクモードの /today セッション開始 */
  KIOSK_SESSION_STARTED: 'ux_kiosk_session_started',

  /** タブ復帰時の refresh が完了した */
  VISIBLE_REFRESH_COMPLETED: 'ux_visible_refresh_completed',

  /** QuickRecord を開始してから保存まで完了した */
  QUICK_RECORD_SAVE_COMPLETED: 'ux_quick_record_save_completed',

  /** QuickRecord を開始したが保存せずに閉じた */
  QUICK_RECORD_ABANDONED: 'ux_quick_record_abandoned',

  /** QuickRecord を開始した */
  QUICK_RECORD_STARTED: 'ux_quick_record_started',
} as const;

export type KioskTelemetryEventName =
  (typeof KIOSK_TELEMETRY_EVENTS)[keyof typeof KIOSK_TELEMETRY_EVENTS];

/**
 * 最小限の共通Payload構造
 * ログが散らからないよう、事前に形式を統一しておく
 */
export interface KioskNavigationPayload {
  /** 現在のレイアウトモード */
  mode: 'normal' | 'kiosk';

  /**
   * ナビゲーションの「遷移先（目的地）」
   * ※`ux_navigate_from_today` などの場合にセット
   */
  target?: KioskQuickLinkId;

  /** 遷移先パス（UI側との突合せ用） */
  to?: string;

  /**
   * ナビゲーションの「起点（トリガー箇所）」
   * - `today` : Todayダッシュボード内のクイックリンクや進捗リングから
   * - `fab` : 右下のFAB長押しメニューから
   * - `header_back` : 左上の「今日の業務に戻る」ボタンから
   */
  source: 'today' | 'fab' | 'header_back';

  /** 追加計測値（イベント種別に応じて使用） */
  durationMs?: number;
  reason?: 'polling' | 'visibility_restore' | 'close_without_save' | 'save' | 'start';
  modeVariant?: 'user' | 'unfilled';
  autoNextEnabled?: boolean;
  userId?: string;
  sessionId?: string;
  role?: 'staff' | 'admin' | 'unknown';
}
