/**
 * cross-module/navigationState.ts
 * 
 * モジュール間遷移で使用する navigation state の型定義
 * React Router の location.state として渡される
 */

/**
 * DailyRecordPage への遷移時に使用する state
 */
export type DailyActivityNavState = {
  /**
   * ハイライトする利用者ID
   * 指定された利用者のカードへスクロール＋一時ハイライト表示
   */
  highlightUserId?: string;

  /**
   * ハイライトする日付 (YYYY-MM-DD, local)
   * 指定された日付の記録にフィルタ/フォーカス
   */
  highlightDate?: string;
};

/**
 * HandoffTimelinePage への遷移時に使用する state
 */
export type HandoffTimelineNavState = {
  /**
   * 日付スコープ (今日/昨日)
   */
  dayScope?: 'today' | 'yesterday';

  /**
   * 時間帯フィルタ
   */
  timeFilter?: 'all' | 'morning' | 'evening';

  /**
   * フォーカスする利用者ID（将来の Phase で使用予定）
   */
  focusUserId?: string;
};
