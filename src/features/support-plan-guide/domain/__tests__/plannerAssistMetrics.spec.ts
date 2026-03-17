/**
 * plannerAssistMetrics.spec — P6-A: 4指標の pure 集計テスト
 */

import { describe, it, expect } from 'vitest';
import {
  computeFirstNavigationDistribution,
  computeActionClickRate,
  computeNavigationLatency,
  computeAdoptionUplift,
  computePlannerAssistMetrics,
  generateSessionId,
  generateInteractionId,
  type PlannerAssistEvent,
  type PlannerAssistEventBase,
} from '../plannerAssistMetrics';

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

const BASE: PlannerAssistEventBase = {
  sessionId: 'ses-1',
  userRole: 'planner',
  targetUserId: 'user-1',
  panelVersion: 'v1.0-p5c3',
  occurredAt: '2026-03-10T10:00:00Z',
};

function makeEvent(
  overrides: Partial<PlannerAssistEvent> & Pick<PlannerAssistEvent, 'type'>,
): PlannerAssistEvent {
  return { ...BASE, ...overrides } as PlannerAssistEvent;
}

// ────────────────────────────────────────────
// ID 生成
// ────────────────────────────────────────────

describe('generateSessionId / generateInteractionId', () => {
  it('sessionId は pas_ で始まる', () => {
    expect(generateSessionId()).toMatch(/^pas_/);
  });

  it('interactionId は pai_ で始まる', () => {
    expect(generateInteractionId()).toMatch(/^pai_/);
  });

  it('連続呼び出しで異なる値を返す', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});

// ────────────────────────────────────────────
// 指標1: 初回遷移先の分布
// ────────────────────────────────────────────

describe('computeFirstNavigationDistribution', () => {
  it('session ごとの最初の tab_landed をカウントする', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-1',
        actionCount: 3,
        acceptanceRate: 0.7,
        occurredAt: '2026-03-10T10:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        sessionId: 'ses-1',
        interactionId: 'pai-1',
        tab: 'smart',
        elapsedMs: 500,
        occurredAt: '2026-03-10T10:00:01Z',
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        sessionId: 'ses-1',
        interactionId: 'pai-2',
        tab: 'monitoring',
        elapsedMs: 800,
        occurredAt: '2026-03-10T10:00:05Z',
      }),
    ];

    const result = computeFirstNavigationDistribution(events);
    expect(result).toEqual({ smart: 1 });
  });

  it('複数 session を正しくカウントする', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-1',
        actionCount: 2,
        acceptanceRate: 0.5,
        occurredAt: '2026-03-10T10:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        sessionId: 'ses-1',
        interactionId: 'pai-1',
        tab: 'smart',
        elapsedMs: 300,
        occurredAt: '2026-03-10T10:00:01Z',
      }),
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-2',
        actionCount: 4,
        acceptanceRate: 0.8,
        occurredAt: '2026-03-10T11:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        sessionId: 'ses-2',
        interactionId: 'pai-2',
        tab: 'monitoring',
        elapsedMs: 600,
        occurredAt: '2026-03-10T11:00:02Z',
      }),
    ];

    const result = computeFirstNavigationDistribution(events);
    expect(result).toEqual({ smart: 1, monitoring: 1 });
  });

  it('panel_shown がない session の tab_landed は無視する', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_tab_landed',
        sessionId: 'ses-orphan',
        interactionId: 'pai-x',
        tab: 'smart',
        elapsedMs: 100,
        occurredAt: '2026-03-10T10:00:00Z',
      }),
    ];

    const result = computeFirstNavigationDistribution(events);
    expect(result).toEqual({});
  });

  it('イベントが空なら空オブジェクトを返す', () => {
    expect(computeFirstNavigationDistribution([])).toEqual({});
  });
});

// ────────────────────────────────────────────
// 指標2: アクション押下率
// ────────────────────────────────────────────

describe('computeActionClickRate', () => {
  it('カテゴリ別 click 数と session あたり平均を算出する', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-1',
        actionCount: 3,
        acceptanceRate: 0.7,
      }),
      makeEvent({
        type: 'planner_assist_action_clicked',
        sessionId: 'ses-1',
        interactionId: 'pai-1',
        actionCategory: 'pendingSuggestions',
        targetTab: 'smart',
      }),
      makeEvent({
        type: 'planner_assist_action_clicked',
        sessionId: 'ses-1',
        interactionId: 'pai-2',
        actionCategory: 'regulatoryIssues',
        targetTab: 'monitoring',
      }),
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-2',
        actionCount: 2,
        acceptanceRate: 0.5,
      }),
      makeEvent({
        type: 'planner_assist_action_clicked',
        sessionId: 'ses-2',
        interactionId: 'pai-3',
        actionCategory: 'pendingSuggestions',
        targetTab: 'smart',
      }),
    ];

    const result = computeActionClickRate(events);

    expect(result.totalSessions).toBe(2);
    expect(result.totalClicks).toBe(3);
    expect(result.clicksPerSession).toBe(1.5);
    expect(result.byCategory).toEqual({
      pendingSuggestions: 2,
      regulatoryIssues: 1,
    });
  });

  it('click がなければ clicksPerSession=0', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-1',
        actionCount: 3,
        acceptanceRate: 0.7,
      }),
    ];

    const result = computeActionClickRate(events);
    expect(result.clicksPerSession).toBe(0);
    expect(result.totalClicks).toBe(0);
  });

  it('session がなければ clicksPerSession=0', () => {
    const result = computeActionClickRate([]);
    expect(result.clicksPerSession).toBe(0);
  });
});

// ────────────────────────────────────────────
// 指標3: 到達時間
// ────────────────────────────────────────────

describe('computeNavigationLatency', () => {
  it('median / mean / p90 を算出する', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_tab_landed',
        interactionId: 'pai-1',
        tab: 'smart',
        elapsedMs: 200,
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        interactionId: 'pai-2',
        tab: 'monitoring',
        elapsedMs: 400,
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        interactionId: 'pai-3',
        tab: 'planning',
        elapsedMs: 600,
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        interactionId: 'pai-4',
        tab: 'records',
        elapsedMs: 800,
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        interactionId: 'pai-5',
        tab: 'smart',
        elapsedMs: 1000,
      }),
    ];

    const result = computeNavigationLatency(events);

    expect(result.latencies).toEqual([200, 400, 600, 800, 1000]);
    expect(result.medianMs).toBe(600);
    expect(result.meanMs).toBe(600);
    expect(result.p90Ms).toBe(1000);
  });

  it('空イベントですべて 0 を返す', () => {
    const result = computeNavigationLatency([]);
    expect(result).toEqual({ latencies: [], medianMs: 0, meanMs: 0, p90Ms: 0 });
  });

  it('tab_landed 以外のイベントは無視する', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-1',
        actionCount: 3,
        acceptanceRate: 0.7,
      }),
    ];

    const result = computeNavigationLatency(events);
    expect(result.latencies).toEqual([]);
  });

  it('1件の場合は median = mean = p90', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_tab_landed',
        interactionId: 'pai-1',
        tab: 'smart',
        elapsedMs: 500,
      }),
    ];

    const result = computeNavigationLatency(events);
    expect(result.medianMs).toBe(500);
    expect(result.meanMs).toBe(500);
    expect(result.p90Ms).toBe(500);
  });
});

// ────────────────────────────────────────────
// 指標4: 採用率変化
// ────────────────────────────────────────────

describe('computeAdoptionUplift', () => {
  it('cutoff 前後の平均採用率と uplift を算出する', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate: 0.5,
        totalDecisions: 10,
        weeklyDecisions: 3,
        weeklyAcceptanceRate: 0.4,
        occurredAt: '2026-03-01T10:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate: 0.6,
        totalDecisions: 15,
        weeklyDecisions: 5,
        weeklyAcceptanceRate: 0.5,
        occurredAt: '2026-03-05T10:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate: 0.8,
        totalDecisions: 20,
        weeklyDecisions: 5,
        weeklyAcceptanceRate: 0.7,
        occurredAt: '2026-03-15T10:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate: 0.9,
        totalDecisions: 25,
        weeklyDecisions: 5,
        weeklyAcceptanceRate: 0.85,
        occurredAt: '2026-03-20T10:00:00Z',
      }),
    ];

    const result = computeAdoptionUplift(events, '2026-03-10T00:00:00Z');

    // before: (0.5 + 0.6) / 2 = 0.55
    expect(result.beforeRate).toBeCloseTo(0.55, 5);
    // after: (0.8 + 0.9) / 2 = 0.85
    expect(result.afterRate).toBeCloseTo(0.85, 5);
    expect(result.sampleCount).toBe(4);
    // uplift: 0.85 - 0.55 = 0.30
    expect(result.uplift).toBeCloseTo(0.3, 5);
  });

  it('before のみの場合は afterRate=0, uplift が負になる', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate: 0.7,
        totalDecisions: 10,
        weeklyDecisions: 3,
        weeklyAcceptanceRate: 0.5,
        occurredAt: '2026-03-01T10:00:00Z',
      }),
    ];

    const result = computeAdoptionUplift(events, '2026-03-10T00:00:00Z');
    expect(result.beforeRate).toBe(0.7);
    expect(result.afterRate).toBe(0);
    expect(result.uplift).toBe(-0.7);
  });

  it('snapshot がなければすべて 0 を返す', () => {
    const result = computeAdoptionUplift([], '2026-03-10T00:00:00Z');
    expect(result).toEqual({
      beforeRate: 0,
      afterRate: 0,
      sampleCount: 0,
      uplift: 0,
    });
  });
});

// ────────────────────────────────────────────
// 4指標統合
// ────────────────────────────────────────────

describe('computePlannerAssistMetrics', () => {
  it('4指標すべてのキーを返す', () => {
    const result = computePlannerAssistMetrics([], '2026-03-10T00:00:00Z');

    expect(result).toHaveProperty('firstNavigation');
    expect(result).toHaveProperty('actionClickRate');
    expect(result).toHaveProperty('navigationLatency');
    expect(result).toHaveProperty('adoptionUplift');
  });

  it('混合イベントを正しく分配する', () => {
    const events: PlannerAssistEvent[] = [
      makeEvent({
        type: 'planner_assist_panel_shown',
        sessionId: 'ses-1',
        actionCount: 3,
        acceptanceRate: 0.7,
        occurredAt: '2026-03-15T10:00:00Z',
      }),
      makeEvent({
        type: 'planner_assist_action_clicked',
        sessionId: 'ses-1',
        interactionId: 'pai-1',
        actionCategory: 'pendingSuggestions',
        targetTab: 'smart',
        occurredAt: '2026-03-15T10:00:01Z',
      }),
      makeEvent({
        type: 'planner_assist_tab_landed',
        sessionId: 'ses-1',
        interactionId: 'pai-1',
        tab: 'smart',
        elapsedMs: 500,
        occurredAt: '2026-03-15T10:00:02Z',
      }),
      makeEvent({
        type: 'planner_assist_adoption_snapshot',
        acceptanceRate: 0.8,
        totalDecisions: 20,
        weeklyDecisions: 5,
        weeklyAcceptanceRate: 0.7,
        occurredAt: '2026-03-15T10:00:00Z',
      }),
    ];

    const result = computePlannerAssistMetrics(events, '2026-03-10T00:00:00Z');

    expect(result.firstNavigation).toEqual({ smart: 1 });
    expect(result.actionClickRate.totalClicks).toBe(1);
    expect(result.navigationLatency.medianMs).toBe(500);
    expect(result.adoptionUplift.afterRate).toBe(0.8);
  });
});
