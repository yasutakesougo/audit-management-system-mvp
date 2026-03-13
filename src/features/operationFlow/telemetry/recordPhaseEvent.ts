/**
 * OperationalPhase Telemetry
 *
 * OperationalPhase 導入の効果測定に使う観測イベントを定義・送信する。
 *
 * イベント一覧:
 *   - phase-suggest-shown     : フェーズ提案バナーが表示された
 *   - phase-suggest-accepted  : フェーズ提案が受け入れられた
 *   - phase-suggest-dismissed : フェーズ提案が閉じられた
 *   - meeting-mode-suggested  : 会議モード提案が表示された
 *   - meeting-mode-accepted   : 会議モード提案が受け入れられた
 *   - meeting-mode-dismissed  : 会議モード提案が閉じられた
 *   - config-load-fallback    : 設定ロードが失敗しフォールバックした
 *
 * 設計方針:
 *   - Fire-and-forget (UI に影響しない)
 *   - 既存の Firestore telemetry コレクションに統一
 *   - 重複送信ガード付き
 *
 * @module features/operationFlow/telemetry/recordPhaseEvent
 */
import { db } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// ── イベント名定数 ──────────────────────────────────────────

export const PHASE_EVENTS = {
  /** TodayPhaseIndicator / DailyPhaseHintBanner 表示 */
  SUGGEST_SHOWN: 'phase-suggest-shown',
  /** TodayPhaseIndicator の主役画面遷移クリック */
  SUGGEST_ACCEPTED: 'phase-suggest-accepted',
  /** TodayPhaseIndicator / DailyPhaseHintBanner の dismiss */
  SUGGEST_DISMISSED: 'phase-suggest-dismissed',
  /** MeetingModeSuggestionBanner 表示 */
  MEETING_SUGGESTED: 'meeting-mode-suggested',
  /** MeetingModeSuggestionBanner の accept */
  MEETING_ACCEPTED: 'meeting-mode-accepted',
  /** MeetingModeSuggestionBanner の dismiss */
  MEETING_DISMISSED: 'meeting-mode-dismissed',
  /** useOperationFlowConfig でフォールバック発生 */
  CONFIG_FALLBACK: 'config-load-fallback',
} as const;

export type PhaseEventName = (typeof PHASE_EVENTS)[keyof typeof PHASE_EVENTS];

// ── ペイロード型 ────────────────────────────────────────────

export type PhaseEventPayload = {
  /** イベント名 */
  event: PhaseEventName;
  /** 対象フェーズ（任意） */
  phase?: string;
  /** 画面パス */
  screen?: string;
  /** 提案された meetingMode（meeting-mode 系のみ） */
  suggestedMode?: string;
  /** フォールバック理由（config-load-fallback のみ） */
  reason?: string;
};

// ── 重複送信ガード ──────────────────────────────────────────

/**
 * 同一コンポーネントインスタンス内で同じイベントの重複送信を防ぐための
 * セッション内ガード。shown イベントの連続発火を抑制する。
 */
const _sentGuard = new Set<string>();

/**
 * ガードキーを生成（event + screen + phase/suggestedMode の組合せ）
 */
function guardKey(payload: PhaseEventPayload): string {
  return `${payload.event}:${payload.screen ?? ''}:${payload.phase ?? payload.suggestedMode ?? ''}`;
}

/**
 * ガードをリセットする（テスト用）
 */
export function _resetGuard(): void {
  _sentGuard.clear();
}

// ── 送信関数 ────────────────────────────────────────────────

/**
 * OperationalPhase テレメトリイベントを Firestore に送信する。
 *
 * Fire-and-forget: 送信失敗は console.warn のみ。UI に影響しない。
 *
 * @param payload - イベントペイロード
 * @param options - 送信オプション
 * @param options.dedupe - true の場合、同一セッション中の重複送信を防ぐ（デフォルト: false）
 */
export function recordPhaseEvent(
  payload: PhaseEventPayload,
  options: { dedupe?: boolean } = {},
): void {
  // 重複送信ガード
  if (options.dedupe) {
    const key = guardKey(payload);
    if (_sentGuard.has(key)) return;
    _sentGuard.add(key);
  }

  const doc = {
    ...payload,
    type: 'operational_phase_event' as const,
    ts: serverTimestamp(),
    clientTs: new Date().toISOString(),
  };

  try {
    addDoc(collection(db, 'telemetry'), doc).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[phase-telemetry] write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[phase-telemetry] skipped (db not ready)', err);
  }
}
