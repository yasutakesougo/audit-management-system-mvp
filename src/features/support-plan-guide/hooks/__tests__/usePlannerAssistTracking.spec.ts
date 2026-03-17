/**
 * usePlannerAssistTracking.spec — P6-A: イベント発火 hook テスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerAssistTracking } from '../usePlannerAssistTracking';
import type { PlannerAssistEvent } from '../../domain/plannerAssistMetrics';

describe('usePlannerAssistTracking', () => {
  let emittedEvents: PlannerAssistEvent[];
  let onEvent: (event: PlannerAssistEvent) => void;

  beforeEach(() => {
    emittedEvents = [];
    onEvent = (event) => emittedEvents.push(event);
  });

  function renderTracker() {
    return renderHook(() =>
      usePlannerAssistTracking({
        userRole: 'planner',
        targetUserId: 'user-1',
        onEvent,
      }),
    );
  }

  it('sessionId が pas_ で始まる', () => {
    const { result } = renderTracker();
    expect(result.current.sessionId).toMatch(/^pas_/);
  });

  it('trackPanelShown で panel_shown イベントを発火する', () => {
    const { result } = renderTracker();

    act(() => {
      result.current.trackPanelShown(3, 0.75);
    });

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0];
    expect(event.type).toBe('planner_assist_panel_shown');
    if (event.type === 'planner_assist_panel_shown') {
      expect(event.actionCount).toBe(3);
      expect(event.acceptanceRate).toBe(0.75);
      expect(event.userRole).toBe('planner');
      expect(event.targetUserId).toBe('user-1');
      expect(event.panelVersion).toBe('v1.0-p5c3');
    }
  });

  it('trackActionClicked で action_clicked イベントを発火し interactionId を返す', () => {
    const { result } = renderTracker();

    let interactionId = '';
    act(() => {
      interactionId = result.current.trackActionClicked('pendingSuggestions', 'smart');
    });

    expect(interactionId).toMatch(/^pai_/);
    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0];
    expect(event.type).toBe('planner_assist_action_clicked');
    if (event.type === 'planner_assist_action_clicked') {
      expect(event.actionCategory).toBe('pendingSuggestions');
      expect(event.targetTab).toBe('smart');
      expect(event.interactionId).toBe(interactionId);
    }
  });

  it('trackTabLanded で tab_landed イベントを発火し elapsedMs を含む', () => {
    const { result } = renderTracker();

    act(() => {
      result.current.trackActionClicked('regulatoryIssues', 'monitoring');
    });

    // 少し待ってから landed
    act(() => {
      result.current.trackTabLanded('monitoring');
    });

    expect(emittedEvents).toHaveLength(2);
    const landed = emittedEvents[1];
    expect(landed.type).toBe('planner_assist_tab_landed');
    if (landed.type === 'planner_assist_tab_landed') {
      expect(landed.tab).toBe('monitoring');
      expect(landed.elapsedMs).toBeGreaterThanOrEqual(0);
      // interactionId が click と同じ
      const clicked = emittedEvents[0];
      if (clicked.type === 'planner_assist_action_clicked') {
        expect(landed.interactionId).toBe(clicked.interactionId);
      }
    }
  });

  it('trackTabLanded は先行 click がなければ発火しない', () => {
    const { result } = renderTracker();

    act(() => {
      result.current.trackTabLanded('smart');
    });

    expect(emittedEvents).toHaveLength(0);
  });

  it('trackTabLanded は一度消費すると再発火しない', () => {
    const { result } = renderTracker();

    act(() => {
      result.current.trackActionClicked('pendingSuggestions', 'smart');
    });
    act(() => {
      result.current.trackTabLanded('smart');
    });
    act(() => {
      result.current.trackTabLanded('smart'); // ２回目
    });

    // action_clicked: 1 + tab_landed: 1 = 2
    expect(emittedEvents).toHaveLength(2);
  });

  it('trackAdoptionSnapshot で snapshot イベントを発火する', () => {
    const { result } = renderTracker();

    act(() => {
      result.current.trackAdoptionSnapshot(0.8, 20, 5, 0.75);
    });

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0];
    expect(event.type).toBe('planner_assist_adoption_snapshot');
    if (event.type === 'planner_assist_adoption_snapshot') {
      expect(event.acceptanceRate).toBe(0.8);
      expect(event.totalDecisions).toBe(20);
      expect(event.weeklyDecisions).toBe(5);
      expect(event.weeklyAcceptanceRate).toBe(0.75);
    }
  });

  it('全イベントで sessionId が統一される', () => {
    const { result } = renderTracker();

    act(() => {
      result.current.trackPanelShown(3, 0.7);
      result.current.trackActionClicked('pendingSuggestions', 'smart');
    });
    act(() => {
      result.current.trackTabLanded('smart');
      result.current.trackAdoptionSnapshot(0.8, 20, 5, 0.75);
    });

    const sessionIds = emittedEvents.map((e) => e.sessionId);
    expect(new Set(sessionIds).size).toBe(1);
  });
});
