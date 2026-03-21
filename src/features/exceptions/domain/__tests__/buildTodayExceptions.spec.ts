import { describe, expect, it } from 'vitest';
import type { ExceptionItem } from '../exceptionLogic';
import { buildTodayExceptions } from '../buildTodayExceptions';

const baseItem: ExceptionItem = {
  id: 'base-1',
  category: 'critical-handoff',
  severity: 'critical',
  title: 'Test',
  description: 'Desc',
  updatedAt: '2026-03-21T10:00:00.000Z',
  actionLabel: 'Check',
  actionPath: '/path',
  stableId: 's-1',
};

describe('buildTodayExceptions', () => {
  it('1. critical-handoff は返る', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'c-1',
        category: 'critical-handoff',
        severity: 'critical',
      },
    ];
    const actions = buildTodayExceptions(items);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe('critical-handoff');
  });

  it('2. dismissed は除外される', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'c-1',
        stableId: 's-1',
      },
    ];
    const actions = buildTodayExceptions(items, {
      dismissedStableIds: new Set(['s-1']),
    });
    expect(actions).toHaveLength(0);
  });

  it('3. snoozed は除外される', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'c-1',
        stableId: 's-1',
      },
    ];
    const actions = buildTodayExceptions(items, {
      snoozedStableIds: new Set(['s-1']),
    });
    expect(actions).toHaveLength(0);
  });

  it('4. missing-record / attention-user は high 以上だけ返る', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'm-high',
        category: 'missing-record',
        severity: 'high',
      },
      {
        ...baseItem,
        id: 'm-medium',
        category: 'missing-record',
        severity: 'medium',
      },
      {
        ...baseItem,
        id: 'a-critical',
        category: 'attention-user',
        severity: 'critical',
      },
      {
        ...baseItem,
        id: 'a-low',
        category: 'attention-user',
        severity: 'low',
      },
    ];

    const actions = buildTodayExceptions(items);
    
    // high 以上の missing-record と attention-user の2件のみが返るべき
    expect(actions).toHaveLength(2);
    expect(actions.find(a => a.sourceExceptionId === 'm-high')).toBeDefined();
    expect(actions.find(a => a.sourceExceptionId === 'a-critical')).toBeDefined();
    
    // medium や low は除外される
    expect(actions.find(a => a.sourceExceptionId === 'm-medium')).toBeUndefined();
    expect(actions.find(a => a.sourceExceptionId === 'a-low')).toBeUndefined();
  });

  it('5. priority とカテゴリで正しく並ぶ', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'a-high',
        category: 'attention-user',
        severity: 'high',
      },
      {
        ...baseItem,
        id: 'm-critical',
        category: 'missing-record',
        severity: 'critical',
      },
      {
        ...baseItem,
        id: 'c-high',
        category: 'critical-handoff', // priority defaults to 'high' since severity='high'
        severity: 'high',
      },
      {
        ...baseItem,
        id: 'c-critical',
        category: 'critical-handoff',
        severity: 'critical',
      },
    ];

    const actions = buildTodayExceptions(items);

    expect(actions).toHaveLength(4);
    
    // -- priority (critical -> high) -> カテゴリ順 になっているか --
    // 1st: Critical Handoff (Critical)
    expect(actions[0]?.sourceExceptionId).toBe('c-critical');
    // 2nd: Missing Record (Critical)
    expect(actions[1]?.sourceExceptionId).toBe('m-critical');
    // 3rd: Critical Handoff (High)
    expect(actions[2]?.sourceExceptionId).toBe('c-high');
    // 4th: Attention User (High)
    expect(actions[3]?.sourceExceptionId).toBe('a-high');
  });

  it('6. actionPath 無しの扱いは除外される', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'no-path',
        actionPath: undefined,
      },
    ];
    const actions = buildTodayExceptions(items);
    expect(actions).toHaveLength(0);
  });

  it('7. 空配列入力で空配列', () => {
    expect(buildTodayExceptions([])).toEqual([]);
  });

  it('8. 同一 user の複数例外がそのまま返る (集約しない)', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'c-1',
        category: 'critical-handoff',
        targetUserId: 'U-123',
      },
      {
        ...baseItem,
        id: 'm-1',
        category: 'missing-record',
        severity: 'high',
        targetUserId: 'U-123',
      },
    ];
    const actions = buildTodayExceptions(items);
    expect(actions).toHaveLength(2); // 集約されずにそのまま2件返る
  });
});
