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

  // ── Acknowledge ソート規約（ADR-019）────────────────────────
  // 並び規則: 1. priority → 2. acknowledged（未着手優先）→ 3. 既存順

  it('9. 同一 priority 内では acknowledged が末尾へ行く', () => {
    // A: missing-record(high) 未着手, B: critical-handoff(high) 対応中
    // カテゴリ順なら B(critical-handoff=1) が A(missing-record=2) より前のはずだが、
    // acknowledged が secondary sort として優先されるため A → B になる
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'a',
        stableId: 'stable-a',
        category: 'missing-record',
        severity: 'high',
      },
      {
        ...baseItem,
        id: 'b',
        stableId: 'stable-b',
        category: 'critical-handoff',
        severity: 'high',
      },
    ];

    const actions = buildTodayExceptions(items, {
      acknowledgedMap: { 'stable-b': { acknowledgedAt: '2026-04-09T10:00:00.000Z' } },
    });

    expect(actions).toHaveLength(2);
    expect(actions[0]?.sourceExceptionId).toBe('a');  // 未着手が先
    expect(actions[1]?.sourceExceptionId).toBe('b');  // 対応中が末尾
    expect(actions[1]?.acknowledgement?.acknowledgedAt).toBe('2026-04-09T10:00:00.000Z');
  });

  it('10. priority が違う場合は acknowledged で priority を逆転させない', () => {
    // A: critical-handoff(critical) 対応中, B: missing-record(high) 未着手
    // critical > high なので A が先のまま
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'a-crit',
        stableId: 'stable-a-crit',
        category: 'critical-handoff',
        severity: 'critical',
      },
      {
        ...baseItem,
        id: 'b-high',
        stableId: 'stable-b-high',
        category: 'missing-record',
        severity: 'high',
      },
    ];

    const actions = buildTodayExceptions(items, {
      acknowledgedMap: { 'stable-a-crit': { acknowledgedAt: '2026-04-09T10:00:00.000Z' } },
    });

    expect(actions).toHaveLength(2);
    expect(actions[0]?.sourceExceptionId).toBe('a-crit');  // critical は acknowledged でも先
    expect(actions[1]?.sourceExceptionId).toBe('b-high');
  });

  it('11. 同一 acknowledged 状態どうしでは既存のカテゴリ順が保たれる', () => {
    // 全員未着手: カテゴリ順 critical-handoff(1) < missing-record(2) < attention-user(3)
    // 全員対応中でも同じカテゴリ順が保たれることを確認
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'att',
        stableId: 's-att',
        category: 'attention-user',
        severity: 'high',
      },
      {
        ...baseItem,
        id: 'miss',
        stableId: 's-miss',
        category: 'missing-record',
        severity: 'high',
      },
      {
        ...baseItem,
        id: 'hand',
        stableId: 's-hand',
        category: 'critical-handoff',
        severity: 'high',
      },
    ];

    // 全員対応中（acknowledged）でもカテゴリ順は保たれる
    const ackMap = {
      's-att': { acknowledgedAt: '2026-04-09T10:00:00.000Z' },
      's-miss': { acknowledgedAt: '2026-04-09T10:00:00.000Z' },
      's-hand': { acknowledgedAt: '2026-04-09T10:00:00.000Z' },
    };

    const actions = buildTodayExceptions(items, { acknowledgedMap: ackMap });

    expect(actions).toHaveLength(3);
    expect(actions[0]?.sourceExceptionId).toBe('hand');  // critical-handoff = 1
    expect(actions[1]?.sourceExceptionId).toBe('miss');  // missing-record = 2
    expect(actions[2]?.sourceExceptionId).toBe('att');   // attention-user = 3
  });

  // ── Resolved 除外規約（ADR-019）────────────────────────────
  // resolved = 意図的な完了。dismissed と同様にアクティブリストから除外される。
  // 差異: dismissed は「個人的非表示」、resolved は「業務上の閉鎖」（意味が違う）

  it('12. resolved なシグナルはアクティブリストから除外される', () => {
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'r-1',
        stableId: 'stable-r',
        category: 'critical-handoff',
        severity: 'critical',
      },
      {
        ...baseItem,
        id: 'r-2',
        stableId: 'stable-keep',
        category: 'missing-record',
        severity: 'high',
      },
    ];

    const actions = buildTodayExceptions(items, {
      resolvedMap: {
        'stable-r': { resolvedAt: '2026-04-09T11:00:00.000Z', resolutionMode: 'manual' },
      },
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.sourceExceptionId).toBe('r-2');  // resolved でない方だけ残る
  });

  it('13. resolved と acknowledged が共存する場合、resolved が優先して除外される', () => {
    // acknowledged かつ resolved → アクティブリストから消える（resolved が勝つ）
    const items: ExceptionItem[] = [
      {
        ...baseItem,
        id: 'ra-1',
        stableId: 'stable-ra',
        category: 'critical-handoff',
        severity: 'critical',
      },
    ];

    const actions = buildTodayExceptions(items, {
      acknowledgedMap: { 'stable-ra': { acknowledgedAt: '2026-04-09T10:00:00.000Z' } },
      resolvedMap: { 'stable-ra': { resolvedAt: '2026-04-09T11:00:00.000Z', resolutionMode: 'manual' } },
    });

    expect(actions).toHaveLength(0);  // resolved なので除外
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
