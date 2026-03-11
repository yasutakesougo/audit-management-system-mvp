/**
 * TodayScene — 福祉施設の1日の運営フェーズ
 *
 * 時刻ベースではなく「場面」としてモデル化。
 * 場面の推定には inferTodayScene を使うが、
 * これはあくまでヒューリスティクスであり運営を制御しない。
 */
export type TodayScene =
  | 'morning-briefing'
  | 'arrival-intake'
  | 'before-am-activity'
  | 'am-activity'
  | 'lunch-transition'
  | 'before-pm-activity'
  | 'pm-activity'
  | 'post-activity'
  | 'before-departure'
  | 'day-closing';

/** 場面ラベル（UI 表示用） */
export const sceneLabelMap: Record<TodayScene, string> = {
  'morning-briefing': '朝礼',
  'arrival-intake': '通所受け入れ',
  'before-am-activity': '午前活動前',
  'am-activity': '午前活動',
  'lunch-transition': '昼食前後',
  'before-pm-activity': '午後活動前',
  'pm-activity': '午後活動',
  'post-activity': '活動終了後',
  'before-departure': '退所前',
  'day-closing': '終礼',
};
