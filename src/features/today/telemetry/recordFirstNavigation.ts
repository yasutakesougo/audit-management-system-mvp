/**
 * TodayOps First-Navigation Telemetry
 *
 * /today ページに着地したユーザーが「最初にどの画面に遷移したか」を記録する。
 *
 * 目的:
 *   - 「時間帯 × 初回遷移画面」のクロス分析
 *   - OperationalPhase の主役マッピング精度の検証
 *   - phase-suggest の有効性評価（suggest 経由 vs 直接遷移 vs CTA 経由）
 *
 * 使い方:
 *   1. TodayOpsPage マウント時に createFirstNavigationTracker() でトラッカーを生成
 *   2. ナビゲーション発火時に tracker.record(targetUrl, trigger) を呼ぶ
 *   3. 1ページロードにつき最初の1回のみ記録（2回目以降は noop）
 *
 * Fire-and-forget — 書き込み失敗は無視し、UI をブロックしない。
 *
 * @see docs/design/today-page-architecture.md
 */
import { db } from '@/infra/firestore/client';
import type { OperationalPhase } from '@/shared/domain/operationalPhase';
import type { DayPhase } from '../lib/resolvePhase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// ── トリガー種別 ──────────────────────────────────────────
/** 初回遷移のきっかけ */
export type NavigationTrigger =
  | 'phase-suggest'   // TodayPhaseIndicator の主役画面リンク
  | 'cta-primary'     // NextActionCard の主 CTA
  | 'cta-scene'       // Scene guidance CTA
  | 'cta-schedule'    // スケジュールコンテキスト部分
  | 'cta-empty'       // Empty state CTA
  | 'cta-utility'     // 補助導線
  | 'widget-chip'     // ProgressStatusBar / AttendanceSummaryCard のチップ
  | 'sidebar-nav'     // サイドバーメニュー / ヘッダーナビ
  | 'unknown';        // 判別不能（back, 直接入力 等）

// ── イベントペイロード ──────────────────────────────────────
export type FirstNavigationEvent = {
  /** 遷移先URL */
  targetUrl: string;
  /** トリガー種別 */
  trigger: NavigationTrigger;
  /** /today 滞在時間（ms） */
  dwellMs: number;
  /** 着地時の6分割フェーズ */
  operationalPhase: OperationalPhase;
  /** 着地時の3分割フェーズ */
  dayPhase: DayPhase;
  /** ユーザーロール */
  role: string;
};

// ── Tracker Factory ─────────────────────────────────────
export type FirstNavigationTracker = {
  /** 初回遷移を記録（2回目以降は noop） */
  record: (targetUrl: string, trigger: NavigationTrigger) => void;
  /** 記録済みかどうか */
  readonly recorded: boolean;
};

/**
 * ページロード時に1つ作り、各ナビゲーションハンドラから record() を呼ぶ。
 * 最初の1回だけ Firestore に書き込む。
 */
export function createFirstNavigationTracker(opts: {
  operationalPhase: OperationalPhase;
  dayPhase: DayPhase;
  role: string;
}): FirstNavigationTracker {
  const mountedAt = Date.now();
  let _recorded = false;

  return {
    get recorded() {
      return _recorded;
    },
    record(targetUrl: string, trigger: NavigationTrigger) {
      if (_recorded) return;
      _recorded = true;

      const event: FirstNavigationEvent = {
        targetUrl,
        trigger,
        dwellMs: Date.now() - mountedAt,
        operationalPhase: opts.operationalPhase,
        dayPhase: opts.dayPhase,
        role: opts.role,
      };

      const payload = {
        ...event,
        type: 'todayops_first_navigation' as const,
        ts: serverTimestamp(),
        clientTs: new Date().toISOString(),
      };

      try {
        addDoc(collection(db, 'telemetry'), payload).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[todayops:first-nav] telemetry write failed', err);
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[todayops:first-nav] telemetry skipped (db not ready)', err);
      }
    },
  };
}
