/**
 * OperationalPhase — 福祉事業所の1日を6つの業務フェーズに分割
 *
 * 目的:
 *   - 既存3系統の時間判定（TodayScene / TimeBand / isMorningTime）を
 *     横断する共通時間軸として機能する
 *   - 画面遷移サジェスト、時間帯別UIヒントの共通基盤
 *
 * 設計方針:
 *   - 既存の TodayScene / MeetingMode / TimeBand は削除しない
 *   - UI依存のない純粋関数のみ
 *   - 橋渡し層として、既存概念へのマッピング関数を提供
 *
 * 時間境界値（分）:
 *   preparation     06:00 (360)  ~ 08:29 (509)  出勤・朝準備
 *   morning-meeting 08:30 (510)  ~ 09:14 (554)  朝会
 *   am-operation    09:15 (555)  ~ 11:59 (719)  AM活動（利用者受入→午前プログラム）
 *   pm-operation    12:00 (720)  ~ 15:29 (929)  PM活動（昼食→午後プログラム）
 *   evening-closing 15:30 (930)  ~ 16:59 (1019) 帰り支度・送迎・夕会
 *   record-review   17:00 (1020) ~ 05:59 (359)  記録・振り返り・翌日準備
 */

import type { MeetingMode, TimeBand } from '@/features/handoff/handoffTypes';
import type { TodayScene } from '@/features/today/domain/todayScene';

// ────────────────────────────────────────
// 型定義
// ────────────────────────────────────────

/** 福祉事業所の業務フェーズ（1日6分割） */
export type OperationalPhase =
  | 'preparation'      // 06:00-08:29  出勤・朝準備
  | 'morning-meeting'  // 08:30-09:14  朝会
  | 'am-operation'     // 09:15-11:59  AM活動
  | 'pm-operation'     // 12:00-15:29  PM活動
  | 'evening-closing'  // 15:30-16:59  帰り支度・送迎・夕会
  | 'record-review';   // 17:00-05:59  記録・振り返り・翌日準備

/** フェーズごとの主役画面パス */
export type PrimaryScreen =
  | '/today'
  | '/daily'
  | '/handoff-timeline'
  | '/dashboard';

// ────────────────────────────────────────
// コア判定関数
// ────────────────────────────────────────

/**
 * 指定時刻から業務フェーズを判定する
 *
 * @param now - 判定対象の日時（デフォルト: 現在時刻）
 * @returns 現在の業務フェーズ
 *
 * 境界値ルール:
 *   - 各境界は「以上〜未満」（start inclusive, end exclusive）
 *   - 深夜(0:00-5:59) は record-review に含む
 */
export function getCurrentPhase(now: Date = new Date()): OperationalPhase {
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m; // 分に変換して比較

  // 06:00 (360) ~ 08:29 (509)
  if (t >= 360 && t < 510) return 'preparation';

  // 08:30 (510) ~ 09:14 (554)
  if (t >= 510 && t < 555) return 'morning-meeting';

  // 09:15 (555) ~ 11:59 (719)
  if (t >= 555 && t < 720) return 'am-operation';

  // 12:00 (720) ~ 15:29 (929)
  if (t >= 720 && t < 930) return 'pm-operation';

  // 15:30 (930) ~ 16:59 (1019)
  if (t >= 930 && t < 1020) return 'evening-closing';

  // 17:00 (1020) ~ 05:59 (359) — 日をまたぐ
  return 'record-review';
}

// ────────────────────────────────────────
// ラベル・表示用
// ────────────────────────────────────────

/** フェーズの日本語ラベル */
const PHASE_LABELS: Record<OperationalPhase, string> = {
  'preparation':     '出勤・朝準備',
  'morning-meeting': '朝会',
  'am-operation':    'AM活動',
  'pm-operation':    'PM活動',
  'evening-closing': '夕会・帰り支度',
  'record-review':   '記録・振り返り',
};

/**
 * フェーズの日本語ラベルを返す
 */
export function getPhaseLabel(phase: OperationalPhase): string {
  return PHASE_LABELS[phase];
}

// ────────────────────────────────────────
// 主役画面マッピング
// ────────────────────────────────────────

/**
 * フェーズに対する主役画面パスを返す
 *
 * 主役画面 = 「このフェーズで最も使われるべき画面」
 *
 * マッピング根拠:
 *   preparation     → /today       出勤直後に「今日やること」を確認
 *   morning-meeting → /handoff     朝会で申し送りを読み上げ・確認
 *   am-operation    → /today       午前活動中に「次の行動」を見て記録
 *   pm-operation    → /daily       午後は記録作業が中心
 *   evening-closing → /handoff     夕会で今日の申し送りを確認・持越し
 *   record-review   → /dashboard   管理者が「今日はどうだったか」を俯瞰
 */
export function getPrimaryScreen(phase: OperationalPhase): PrimaryScreen {
  switch (phase) {
    case 'preparation':     return '/today';
    case 'morning-meeting': return '/handoff-timeline';
    case 'am-operation':    return '/today';
    case 'pm-operation':    return '/daily';
    case 'evening-closing': return '/handoff-timeline';
    case 'record-review':   return '/dashboard';
  }
}

// ────────────────────────────────────────
// 橋渡し関数: 既存概念へのマッピング
// ────────────────────────────────────────

/**
 * フェーズから推奨される MeetingMode を返す
 *
 * 朝会・夕会フェーズでは対応するモードを返し、
 * それ以外では 'normal' を返す。
 *
 * 既存: MeetingMode = 'normal' | 'evening' | 'morning'
 */
export function phaseSuggestsMeetingMode(phase: OperationalPhase): MeetingMode {
  switch (phase) {
    case 'morning-meeting': return 'morning';
    case 'evening-closing': return 'evening';
    default:                return 'normal';
  }
}

/**
 * フェーズから推奨される TodayScene を返す
 *
 * OperationalPhase は TodayScene より粗い粒度（6 vs 10）なので、
 * 各フェーズの「代表的な場面」を返す。
 * より細かい判定が必要な場合は inferTodayScene() を使う。
 *
 * 既存: TodayScene = 'morning-briefing' | 'arrival-intake' | ... | 'day-closing'
 */
export function phaseSuggestsTodayScene(phase: OperationalPhase): TodayScene {
  switch (phase) {
    case 'preparation':     return 'morning-briefing';
    case 'morning-meeting': return 'morning-briefing';
    case 'am-operation':    return 'am-activity';
    case 'pm-operation':    return 'pm-activity';
    case 'evening-closing': return 'day-closing';
    case 'record-review':   return 'day-closing';
  }
}

/**
 * フェーズから推奨される TimeBand を返す
 *
 * 既存: TimeBand = '朝' | '午前' | '午後' | '夕方'
 */
export function phaseSuggestsTimeBand(phase: OperationalPhase): TimeBand {
  switch (phase) {
    case 'preparation':     return '朝';
    case 'morning-meeting': return '朝';
    case 'am-operation':    return '午前';
    case 'pm-operation':    return '午後';
    case 'evening-closing': return '夕方';
    case 'record-review':   return '夕方';
  }
}

/**
 * フェーズから Dashboard の時間帯判定に相当する値を返す
 *
 * 既存: isMorningTime = hour >= 8 && hour < 12
 *       isEveningTime = hour >= 17 && hour < 19
 */
export function phaseSuggestsDashboardTime(phase: OperationalPhase): {
  isMorningTime: boolean;
  isEveningTime: boolean;
} {
  switch (phase) {
    case 'preparation':
    case 'morning-meeting':
    case 'am-operation':
      return { isMorningTime: true, isEveningTime: false };
    case 'pm-operation':
    case 'evening-closing':
      return { isMorningTime: false, isEveningTime: false };
    case 'record-review':
      return { isMorningTime: false, isEveningTime: true };
  }
}

// ────────────────────────────────────────
// 全フェーズリスト（UI のドロップダウン等で利用）
// ────────────────────────────────────────

/** 1日の業務フェーズを時間順に列挙 */
export const ALL_PHASES: readonly OperationalPhase[] = [
  'preparation',
  'morning-meeting',
  'am-operation',
  'pm-operation',
  'evening-closing',
  'record-review',
] as const;
