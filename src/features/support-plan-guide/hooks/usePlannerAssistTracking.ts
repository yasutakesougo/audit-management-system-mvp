/**
 * usePlannerAssistTracking — Planner Assist イベント発火 hook (P6-A)
 *
 * UI からは「表示された」「押された」「着地した」の emit だけ。
 * 計測定義・解釈は plannerAssistMetrics.ts に寄せる。
 *
 * 責務:
 *  - sessionId / interactionId の発行と保持
 *  - PlannerAssistEvent の構築
 *  - emitter callback の提供
 *
 * UI から見えるのは 4 つの関数だけ:
 *  - trackPanelShown()
 *  - trackActionClicked(category, tab)
 *  - trackTabLanded(tab)
 *  - trackAdoptionSnapshot(rate, totalDecisions, weeklyDecisions, weeklyRate)
 */

import { useCallback, useRef } from 'react';
import type { PlanRole } from '../domain/planPermissions';
import type { PlannerInsightActionKey } from '../domain/plannerInsights';
import type { PlannerAssistEvent } from '../domain/plannerAssistMetrics';
import {
  generateSessionId,
  generateInteractionId,
  CURRENT_PANEL_VERSION,
} from '../domain/plannerAssistMetrics';

// ────────────────────────────────────────────
// 型
// ────────────────────────────────────────────

export type PlannerAssistTracker = {
  /** パネル表示時に呼ぶ */
  trackPanelShown: (actionCount: number, acceptanceRate: number | undefined) => void;
  /** アクション行クリック時に呼ぶ。interactionId を返す */
  trackActionClicked: (category: PlannerInsightActionKey, targetTab: string) => string;
  /** タブ到達時に呼ぶ */
  trackTabLanded: (tab: string) => void;
  /** 採用率スナップショット時に呼ぶ */
  trackAdoptionSnapshot: (
    acceptanceRate: number,
    totalDecisions: number,
    weeklyDecisions: number,
    weeklyAcceptanceRate: number | undefined,
  ) => void;
  /** 現在のセッション ID */
  sessionId: string;
};

export type UsePlannerAssistTrackingInput = {
  userRole: PlanRole;
  targetUserId: string;
  /** イベントの sink。デフォルトは console.debug。DI で差し替え可能 */
  onEvent?: (event: PlannerAssistEvent) => void;
};

// ────────────────────────────────────────────
// デフォルト sink
// ────────────────────────────────────────────

const defaultSink = (event: PlannerAssistEvent): void => {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[PlannerAssist]', event.type, event);
  }
};

// ────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────

export function usePlannerAssistTracking(
  input: UsePlannerAssistTrackingInput,
): PlannerAssistTracker {
  const { userRole, targetUserId, onEvent = defaultSink } = input;

  // セッション ID は hook ライフサイクル（ページロード）で一意
  const sessionIdRef = useRef(generateSessionId());

  // 最後の action_clicked の timestamp と interactionId を保持
  const lastClickRef = useRef<{ interactionId: string; clickedAt: number } | null>(null);

  const makeBase = useCallback(
    () => ({
      sessionId: sessionIdRef.current,
      userRole,
      targetUserId,
      panelVersion: CURRENT_PANEL_VERSION,
      occurredAt: new Date().toISOString(),
    }),
    [userRole, targetUserId],
  );

  const trackPanelShown = useCallback(
    (actionCount: number, acceptanceRate: number | undefined) => {
      onEvent({
        ...makeBase(),
        type: 'planner_assist_panel_shown',
        actionCount,
        acceptanceRate,
      });
    },
    [makeBase, onEvent],
  );

  const trackActionClicked = useCallback(
    (category: PlannerInsightActionKey, targetTab: string): string => {
      const interactionId = generateInteractionId();
      lastClickRef.current = { interactionId, clickedAt: Date.now() };

      onEvent({
        ...makeBase(),
        type: 'planner_assist_action_clicked',
        interactionId,
        actionCategory: category,
        targetTab,
      });

      return interactionId;
    },
    [makeBase, onEvent],
  );

  const trackTabLanded = useCallback(
    (tab: string) => {
      const lastClick = lastClickRef.current;
      if (!lastClick) return;

      const elapsedMs = Date.now() - lastClick.clickedAt;

      onEvent({
        ...makeBase(),
        type: 'planner_assist_tab_landed',
        interactionId: lastClick.interactionId,
        tab,
        elapsedMs,
      });

      // 消費済み
      lastClickRef.current = null;
    },
    [makeBase, onEvent],
  );

  const trackAdoptionSnapshot = useCallback(
    (
      acceptanceRate: number,
      totalDecisions: number,
      weeklyDecisions: number,
      weeklyAcceptanceRate: number | undefined,
    ) => {
      onEvent({
        ...makeBase(),
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate,
        totalDecisions,
        weeklyDecisions,
        weeklyAcceptanceRate,
      });
    },
    [makeBase, onEvent],
  );

  return {
    trackPanelShown,
    trackActionClicked,
    trackTabLanded,
    trackAdoptionSnapshot,
    sessionId: sessionIdRef.current,
  };
}
