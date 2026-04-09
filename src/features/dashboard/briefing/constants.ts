/**
 * /dashboard/briefing ページの定数定義
 *
 * - BRIEFING_TABS: タブ UI 定義
 * - MEETING_GUIDES: 朝会/夕会 進行ガイド
 * - MEETING_CONFIG: 朝会/夕会 表示差分設定
 * - resolveDefaultTab: デフォルトタブ判定（pure function）
 * - startOfWeek: 週の開始日算出（pure function）
 */

import type { BriefingTabValue, MeetingConfig, MeetingGuide, MeetingMode } from './types';

// ---------------------------------------------------------------------------
// Tab 定義
// ---------------------------------------------------------------------------

export const BRIEFING_TABS = [
  { label: '申し送りタイムライン', value: 'timeline' as const },
  { label: '週次サマリー', value: 'weekly' as const },
  { label: '朝会', value: 'morning' as const },
  { label: '夕会', value: 'evening' as const },
] satisfies readonly { label: string; value: BriefingTabValue }[];

/** 表示可能なタブ値の Set（フォールバック判定用） */
const VISIBLE_TAB_VALUES = new Set<BriefingTabValue>(
  BRIEFING_TABS.map((t) => t.value),
);

// ---------------------------------------------------------------------------
// 朝会 / 夕会 — 進行ガイド
// ---------------------------------------------------------------------------

export const MEETING_GUIDES: Record<MeetingMode, MeetingGuide> = {
  morning: {
    title: '朝会',
    subtitle: '今日の要点を確認して、優先対応を揃えます。',
    steps: [
      '安全指標の確認（注意事項があれば共有）',
      '重要・未対応の申し送りを確認',
      '当日の支援・配置の確認',
      '未作成の日々の記録の優先度を確認',
    ],
  },
  evening: {
    title: '夕会',
    subtitle: '今日の振り返りと明日の準備を整えます。',
    steps: [
      '本日の記録・対応状況の確認',
      '重要案件の申し送りを整理',
      '未作成の日々の記録を確認',
      '明日の注意点を共有',
    ],
  },
};

// ---------------------------------------------------------------------------
// 朝会 / 夕会 — 表示差分設定
// ---------------------------------------------------------------------------

export const MEETING_CONFIG: Record<MeetingMode, MeetingConfig> = {
  morning: {
    chipLabel: '朝会',
    chipColor: 'primary',
    timelineLabel: '申し送りタイムライン（昨日）',
    dayScope: 'yesterday',
    alertText:
      '安全指標サマリはダッシュボードの「安全インジケーター」で確認できます。',
  },
  evening: {
    chipLabel: '夕会',
    chipColor: 'secondary',
    timelineLabel: '申し送りタイムライン（今日）',
    dayScope: 'today',
    alertText:
      '記録状況の詳細はダッシュボードの「日々の記録」カードから確認できます。',
  },
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * デフォルトタブの決定
 * - navState.tab があればそれを優先
 * - なければ 14時前 → morning、14時以降 → evening
 */
export const resolveDefaultTab = (
  navTab: BriefingTabValue | string | undefined,
  now: Date = new Date(),
): BriefingTabValue => {
  if (navTab && VISIBLE_TAB_VALUES.has(navTab as BriefingTabValue)) {
    return navTab as BriefingTabValue;
  }
  return now.getHours() < 14 ? 'morning' : 'evening';
};

/**
 * 指定曜日を週の開始とした、直近の開始日を返す
 * @param d - 基準日
 * @param weekStart - 0=日, 1=月（default）
 */
export const startOfWeek = (d: Date, weekStart = 1): Date => {
  const day = d.getDay();
  const diff = (day < weekStart ? 7 : 0) + day - weekStart;
  const base = new Date(d);
  base.setDate(d.getDate() - diff);
  base.setHours(0, 0, 0, 0);
  return base;
};
