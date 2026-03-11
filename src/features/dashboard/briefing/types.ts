/**
 * /dashboard/briefing ページの型定義
 *
 * UI 定数（BRIEFING_TABS など）は constants.ts に配置。
 * ここには純粋な型定義のみを置く。
 */

/**
 * タブの識別値
 *
 * 保留中のタブ（BRIEFING_TABS から一時的に非表示）:
 * - 'management': 運営管理情報 → /dashboard への再配置候補
 * - 'profile': 統合利用者プロファイル → 会議利用ニーズ再確認後に再検討
 */
export type BriefingTabValue =
  | 'timeline'
  | 'weekly'
  | 'morning'
  | 'evening';

/** 朝会 / 夕会の識別 */
export type MeetingMode = 'morning' | 'evening';

/** 進行ガイドの構造 */
export type MeetingGuide = {
  title: string;
  subtitle: string;
  steps: string[];
};

/** 朝会/夕会ごとの表示設定 */
export type MeetingConfig = {
  chipLabel: string;
  chipColor: 'primary' | 'secondary';
  timelineLabel: string;
  dayScope: 'yesterday' | 'today';
  alertText: string;
};
