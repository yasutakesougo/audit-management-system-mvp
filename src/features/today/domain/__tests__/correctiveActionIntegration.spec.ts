// ---------------------------------------------------------------------------
// corrective_action → Today ActionQueue 統合テスト
//
// Action Engine → mapper → buildTodayActionQueue → ActionCard の
// エンドツーエンドパイプラインを検証する。
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { buildTodayActionQueue } from '../engine/buildTodayActionQueue';
import { mapSuggestionToActionSource } from '../engine/mapSuggestionToActionSource';
import type { ActionSuggestion } from '../../../action-engine/domain/types';
import type { RawActionSource } from '../models/queue.types';

const BASE_NOW = new Date('2026-03-21T10:00:00');

function createSuggestion(overrides?: Partial<ActionSuggestion>): ActionSuggestion {
  return {
    id: 'test-id',
    stableId: 'behavior-trend-increase:user-001:2026-W12',
    type: 'assessment_update',
    priority: 'P0',
    targetUserId: 'user-001',
    title: 'アセスメント見直しが必要',
    reason: '行動増加傾向を検知',
    evidence: {
      metric: '行動発生件数（日平均）',
      currentValue: '5.0',
      threshold: '前週比 +30%',
      period: '直近7日 vs 前7日',
      metrics: {
        recentAvg: 5.0,
        previousAvg: 2.0,
        changeRate: 2.5,
        pctIncrease: 150,
      },
    },
    cta: {
      label: 'アセスメントを見直す',
      route: '/assessment',
    },
    createdAt: '2026-03-21T09:00:00Z',
    ruleId: 'behavior-trend-increase',
    ...overrides,
  };
}

function source(overrides?: Partial<RawActionSource>): RawActionSource {
  return {
    id: overrides?.id ?? 'x',
    sourceType: overrides?.sourceType ?? 'schedule',
    title: overrides?.title ?? 'existing task',
    targetTime: overrides?.targetTime,
    slaMinutes: overrides?.slaMinutes,
    isCompleted: overrides?.isCompleted ?? false,
    assignedStaffId: overrides?.assignedStaffId,
    payload: overrides?.payload ?? {},
  };
}

describe('corrective_action → Today ActionQueue 統合', () => {
  it('P0 corrective_action は vital_alert と同じ priority で表示される', () => {
    const suggestion = createSuggestion({ priority: 'P0' });
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue(
      [
        source({ id: 'schedule-1', sourceType: 'schedule' }),
        correctiveSource,
      ],
      BASE_NOW,
    );

    // P0 は P2(schedule) より先頭
    expect(result[0]?.id).toBe(`corrective:${suggestion.stableId}`);
    expect(result[0]?.priority).toBe('P0');
  });

  it('P1 corrective_action は P1 として表示される（P1 に潰されない）', () => {
    const suggestion = createSuggestion({ priority: 'P1' });
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue([correctiveSource], BASE_NOW);

    expect(result[0]?.priority).toBe('P1');
  });

  it('P2 corrective_action は P2 として表示される', () => {
    const suggestion = createSuggestion({ priority: 'P2' });
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue([correctiveSource], BASE_NOW);

    expect(result[0]?.priority).toBe('P2');
  });

  it('contextMessage に evidence 要約が表示される', () => {
    const suggestion = createSuggestion({
      evidence: {
        metric: '行動発生件数（日平均）',
        currentValue: '5.0',
        threshold: '前週比 +30%',
        period: '直近7日 vs 前7日',
        metrics: {
          recentAvg: 5.0,
          previousAvg: 2.0,
          changeRate: 2.5,
          pctIncrease: 150,
        },
      },
    });
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue([correctiveSource], BASE_NOW);

    expect(result[0]?.contextMessage).toBe('前週比 +150%（日平均 2 → 5）');
  });

  it('actionType は NAVIGATE', () => {
    const suggestion = createSuggestion();
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue([correctiveSource], BASE_NOW);

    expect(result[0]?.actionType).toBe('NAVIGATE');
  });

  it('payload に元の suggestion が保持されている', () => {
    const suggestion = createSuggestion();
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue([correctiveSource], BASE_NOW);

    const card = result[0];
    const payload = card?.payload as { suggestion: ActionSuggestion };
    expect(payload.suggestion.stableId).toBe(suggestion.stableId);
    expect(payload.suggestion.cta.route).toBe('/assessment');
  });

  it('既存 sources と corrective sources が正しくソートされる', () => {
    const p0Suggestion = createSuggestion({
      id: 'p0',
      stableId: 'high-intensity:user-001:2026-W12',
      priority: 'P0',
    });
    const p2Suggestion = createSuggestion({
      id: 'p2',
      stableId: 'data-collection:user-001:2026-W12',
      priority: 'P2',
      type: 'data_collection',
    });

    const allSources = [
      source({
        id: 'schedule-1',
        sourceType: 'schedule',
        title: '定時タスク',
      }),
      mapSuggestionToActionSource(p2Suggestion),
      mapSuggestionToActionSource(p0Suggestion),
    ];

    const result = buildTodayActionQueue(allSources, BASE_NOW);

    // P0 corrective → P2 corrective/schedule 順
    expect(result[0]?.priority).toBe('P0');
    expect(result[0]?.id).toBe('corrective:high-intensity:user-001:2026-W12');
  });

  it('corrective_action は requiresAttention が true（P0/P1 の場合）', () => {
    const suggestion = createSuggestion({ priority: 'P1' });
    const correctiveSource = mapSuggestionToActionSource(suggestion);

    const result = buildTodayActionQueue([correctiveSource], BASE_NOW);

    expect(result[0]?.requiresAttention).toBe(true);
  });
});
