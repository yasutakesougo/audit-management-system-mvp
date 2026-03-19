/**
 * Operations CTA Click Telemetry
 *
 * /today, /call-logs, /handoff ページの CTA 押下を Firestore に記録する。
 * Fire-and-forget — 書き込み失敗は無視し、UI をブロックしない。
 *
 * 導線整理後の実データ収集が目的。
 * 「主導線が主導線として機能しているか」を検証するための観測ログ。
 *
 * @see docs/design/today-page-architecture.md
 */
import { db } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// ── イベント名定数 ──────────────────────────────────────────
export const CTA_EVENTS = {
  /** NextActionCard の scene guidance CTA（確認する / 記録する 等） */
  NEXT_ACTION_PRIMARY: 'today_next_action_primary_clicked',
  /** NextActionCard のスケジュールコンテキスト部分タップ */
  NEXT_ACTION_SCHEDULE: 'today_next_action_schedule_clicked',
  /** NextActionCard empty state の「スケジュールを見る」 */
  NEXT_ACTION_EMPTY: 'today_next_action_empty_clicked',
  /** NextActionCard empty state の「その他の記録へ」 */
  NEXT_ACTION_UTILITY: 'today_next_action_utility_clicked',
  /** AttendanceSummaryCard のチップクリック */
  ATTENDANCE_SUMMARY: 'today_attendance_summary_clicked',
  /** BriefingActionList のアイテムクリック */
  BRIEFING_ACTION: 'today_briefing_action_clicked',
  /** ProgressStatusBar 未記録チップ */
  PROGRESS_CHIP_RECORD: 'today_progress_chip_record_clicked',
  /** ProgressStatusBar 出欠未確認チップ */
  PROGRESS_CHIP_ATTENDANCE: 'today_progress_chip_attendance_clicked',
  /** ProgressStatusBar 申し送りチップ */
  PROGRESS_CHIP_BRIEFING: 'today_progress_chip_briefing_clicked',
  /** ProgressRings ケース記録リング */
  PROGRESS_RING_CASE_RECORD: 'today_progress_ring_case_record_clicked',
  /** ProgressRings 連絡リング */
  PROGRESS_RING_CONTACTS: 'today_progress_ring_contacts_clicked',

  // ── CallLog 再設計 ──────────────────────────────────────────
  /** CallLog Hero「完了にする」 */
  CALLLOG_HERO_DONE: 'calllog_hero_done_clicked',
  /** CallLog Priority Queue 行クリック */
  CALLLOG_PRIORITY_ITEM: 'calllog_priority_item_clicked',
  /** CallLog Priority Queue「完了にする」 */
  CALLLOG_PRIORITY_DONE: 'calllog_priority_done_clicked',

  // ── Handoff 再設計 ─────────────────────────────────────────
  /** Handoff Hero「確認する」 */
  HANDOFF_HERO_CONFIRM: 'handoff_hero_confirm_clicked',
  /** Handoff Hero「対応済にする」 */
  HANDOFF_HERO_DONE: 'handoff_hero_done_clicked',
  /** Handoff Priority Queue 行クリック */
  HANDOFF_PRIORITY_ITEM: 'handoff_priority_item_clicked',
  /** Handoff Priority Queue「対応済にする」 */
  HANDOFF_PRIORITY_DONE: 'handoff_priority_done_clicked',
} as const;

export type CtaEventName = (typeof CTA_EVENTS)[keyof typeof CTA_EVENTS];

// ── CTA の状態タイプ ────────────────────────────────────────
export type CtaStateType =
  | 'scene-action'       // Scene guidance 由来のアクション
  | 'schedule-context'   // スケジュールコンテキスト由来
  | 'empty-state'        // 空状態の primary / utility CTA
  | 'navigation'         // opsStep 由来のナビゲーション CTA
  | 'widget-action';     // 下段ウィジェットの操作

// ── イベントペイロード ──────────────────────────────────────
export type CtaClickEvent = {
  /** イベント名（CTA_EVENTS 定数） */
  ctaId: CtaEventName;
  /** ソースコンポーネント名 */
  sourceComponent: string;
  /** 状態タイプ */
  stateType: CtaStateType;
  /** 場面ラベル（任意） */
  scene?: string;
  /** 優先度（任意） */
  priority?: string;
  /** 遷移先URL（任意） */
  targetUrl?: string;
  /** ユーザーロール（任意） */
  userRole?: string;
};

/**
 * Fire-and-forget: Firestore `telemetry` コレクションに CTA クリックを書き込む。
 * エラーは console.warn のみ。UI に影響を与えない。
 */
export function recordCtaClick(event: CtaClickEvent): void {
  const payload = {
    ...event,
    type: 'todayops_cta_click' as const,
    ts: serverTimestamp(),
    clientTs: new Date().toISOString(),
  };

  try {
    addDoc(collection(db, 'telemetry'), payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[todayops:cta] telemetry write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[todayops:cta] telemetry skipped (db not ready)', err);
  }
}
