import { describe, expect, it } from 'vitest';
import {
    buildIrcSummary,
    ResourceWarning,
    UnifiedResourceEvent
} from '../ircSummary';

// Test helper functions
function createMockEvent(overrides?: Partial<UnifiedResourceEvent>): UnifiedResourceEvent {
  return {
    id: `event-${Math.random()}`,
    title: 'Mock Event',
    extendedProps: {
      status: 'pending',
      resourceId: 'resource-1',
    },
    ...overrides,
  };
}

function createMockResourceWarning(totalHours: number): ResourceWarning {
  return {
    totalHours,
    isOver: totalHours > 8,
  };
}

describe('buildIrcSummary', () => {
  describe('基本的な集計機能', () => {
    it('IRCの基本サマリーを生成する', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ id: 'event-1', extendedProps: { status: 'completed' } }),
        createMockEvent({ id: 'event-2', extendedProps: { status: 'pending' } }),
        createMockEvent({ id: 'event-3', extendedProps: { status: 'completed' } }),
      ];
      const resourceWarnings: Record<string, ResourceWarning> = {};

      const result = buildIrcSummary(events, resourceWarnings);

      expect(result.module.name).toBe('irc');
      expect(result.module.label).toBe('統合リソース');
      expect(result.module.total).toBe(3);
      expect(result.module.done).toBe(2);
      expect(result.module.rate).toBe(67); // 2/3 = 66.67% → 67%
      expect(result.alerts).toEqual([]);
    });

    it('イベントが0件の場合を処理する', () => {
      const result = buildIrcSummary([], {});

      expect(result.module.total).toBe(0);
      expect(result.module.done).toBe(0);
      expect(result.module.rate).toBe(0);
      expect(result.alerts).toEqual([]);
    });

    it('全イベント完了の場合は100%を返す', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];

      const result = buildIrcSummary(events, {});

      expect(result.module.rate).toBe(100);
      expect(result.alerts).toEqual([]);
    });
  });

  describe('8時間超過アラート生成', () => {
    it('1-2リソースが8時間超過の場合はwarning alertを生成する', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];
      const resourceWarnings = {
        'resource-1': createMockResourceWarning(8.5),
        'resource-2': createMockResourceWarning(9.2),
        'resource-3': createMockResourceWarning(7.5),
      };

      const result = buildIrcSummary(events, resourceWarnings);

      const overCapacityAlert = result.alerts.find(a => a.id === 'irc-over-capacity');
      expect(overCapacityAlert).toBeDefined();
      expect(overCapacityAlert).toMatchObject({
        id: 'irc-over-capacity',
        module: 'irc',
        severity: 'warning',
        title: '8時間超過リソース 2件',
        href: '/admin/integrated-resource-calendar',
      });
      expect(overCapacityAlert?.message).toContain('resource-1(8.5h)');
      expect(overCapacityAlert?.message).toContain('resource-2(9.2h)');
    });

    it('3リソース以上が8時間超過の場合はerror alertを生成する', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];
      const resourceWarnings = {
        'resource-1': createMockResourceWarning(8.5),
        'resource-2': createMockResourceWarning(9.2),
        'resource-3': createMockResourceWarning(10.1),
        'resource-4': createMockResourceWarning(8.8),
      };

      const result = buildIrcSummary(events, resourceWarnings);

      const overCapacityAlert = result.alerts.find(a => a.id === 'irc-over-capacity');
      expect(overCapacityAlert).toBeDefined();
      expect(overCapacityAlert).toMatchObject({
        id: 'irc-over-capacity',
        module: 'irc',
        severity: 'error',
        title: '8時間超過リソース 4件',
      });
      // 上位3件のみ表示されることを確認
      expect(overCapacityAlert?.message).toContain('resource-1(8.5h)');
      expect(overCapacityAlert?.message).toContain('resource-2(9.2h)');
      expect(overCapacityAlert?.message).toContain('resource-3(10.1h)');
      expect(overCapacityAlert?.message).not.toContain('resource-4');
    });

    it('8時間以下のリソースのみの場合はリソース超過アラートを生成しない', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];
      const resourceWarnings = {
        'resource-1': createMockResourceWarning(7.5),
        'resource-2': createMockResourceWarning(8.0),
        'resource-3': createMockResourceWarning(6.2),
      };

      const result = buildIrcSummary(events, resourceWarnings);

      const overCapacityAlert = result.alerts.find(a => a.id === 'irc-over-capacity');
      expect(overCapacityAlert).toBeUndefined();
    });

    it('8時間ちょうどの場合はリソース超過アラートを生成しない', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];
      const resourceWarnings = {
        'resource-1': createMockResourceWarning(8.0),
      };

      const result = buildIrcSummary(events, resourceWarnings);

      const overCapacityAlert = result.alerts.find(a => a.id === 'irc-over-capacity');
      expect(overCapacityAlert).toBeUndefined();
    });
  });

  describe('完了率アラート生成', () => {
    it('完了率が50%未満の場合はwarning alertを生成する', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'pending' } }),
        createMockEvent({ extendedProps: { status: 'pending' } }),
        createMockEvent({ extendedProps: { status: 'pending' } }),
      ];

      const result = buildIrcSummary(events, {});

      const lowCompletionAlert = result.alerts.find(a => a.id === 'irc-low-completion');
      expect(lowCompletionAlert).toMatchObject({
        id: 'irc-low-completion',
        module: 'irc',
        severity: 'warning',
        title: 'イベント完了率 25%',
        message: 'イベントの完了率が低い状態です',
        href: '/admin/integrated-resource-calendar',
      });
    });

    it('完了率が50%以上の場合は完了率アラートを生成しない', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'pending' } }),
      ];

      const result = buildIrcSummary(events, {});

      const lowCompletionAlert = result.alerts.find(a => a.id === 'irc-low-completion');
      expect(lowCompletionAlert).toBeUndefined();
    });

    it('イベントが0件の場合は完了率アラートを生成しない', () => {
      const result = buildIrcSummary([], {});

      const lowCompletionAlert = result.alerts.find(a => a.id === 'irc-low-completion');
      expect(lowCompletionAlert).toBeUndefined();
    });
  });

  describe('複合ケース', () => {
    it('8時間超過と低完了率が同時に存在する場合は両方のアラートを生成する', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'pending' } }),
        createMockEvent({ extendedProps: { status: 'pending' } }),
      ];
      const resourceWarnings = {
        'resource-1': createMockResourceWarning(9.5),
      };

      const result = buildIrcSummary(events, resourceWarnings);

      expect(result.alerts).toHaveLength(2);

      const overCapacityAlert = result.alerts.find(a => a.id === 'irc-over-capacity');
      expect(overCapacityAlert).toBeDefined();
      expect(overCapacityAlert?.severity).toBe('warning');

      const lowCompletionAlert = result.alerts.find(a => a.id === 'irc-low-completion');
      expect(lowCompletionAlert).toBeDefined();
      expect(lowCompletionAlert?.title).toBe('イベント完了率 33%');
    });

    it('すべて正常な場合はアラートを生成しない', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { status: 'completed' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];
      const resourceWarnings = {
        'resource-1': createMockResourceWarning(7.5),
        'resource-2': createMockResourceWarning(6.0),
      };

      const result = buildIrcSummary(events, resourceWarnings);

      expect(result.alerts).toEqual([]);
      expect(result.module.rate).toBe(100);
    });
  });

  describe('エッジケース', () => {
    it('extendedPropsが未定義のイベントも安全に処理する', () => {
      const events: UnifiedResourceEvent[] = [
        { id: 'event-1', title: 'Event without extendedProps' },
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];

      const result = buildIrcSummary(events, {});

      expect(result.module.total).toBe(2);
      expect(result.module.done).toBe(1); // extendedProps未定義は未完了扱い
      expect(result.module.rate).toBe(50);
    });

    it('statusが未定義のイベントは未完了扱いとする', () => {
      const events: UnifiedResourceEvent[] = [
        createMockEvent({ extendedProps: { resourceId: 'resource-1' } }),
        createMockEvent({ extendedProps: { status: 'completed' } }),
      ];

      const result = buildIrcSummary(events, {});

      expect(result.module.total).toBe(2);
      expect(result.module.done).toBe(1);
      expect(result.module.rate).toBe(50);
    });

    it('resourceWarningsが空の場合も安全に処理する', () => {
      const events: UnifiedResourceEvent[] = [createMockEvent()];

      const result = buildIrcSummary(events, {});

      expect(result.alerts.filter(a => a.id === 'irc-over-capacity')).toHaveLength(0);
      expect(() => buildIrcSummary(events, {})).not.toThrow();
    });
  });
});