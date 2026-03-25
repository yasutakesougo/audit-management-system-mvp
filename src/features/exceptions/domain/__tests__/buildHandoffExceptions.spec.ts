import { describe, expect, it } from 'vitest';
import type { HandoffSummaryItem } from '../exceptionLogic';
import { buildHandoffExceptions } from '../buildHandoffExceptions';

function makeHandoff(
  overrides: Partial<HandoffSummaryItem> & { id: string; userId?: string },
): HandoffSummaryItem {
  return {
    id: overrides.id,
    message: '服薬確認が必要です',
    severity: '重要',
    status: '未対応',
    userId: overrides.userId ?? 'U-001',
    userName: '山田 太郎',
    createdAt: '2026-03-25T09:00:00Z',
    ...overrides,
  };
}

describe('buildHandoffExceptions', () => {
  it('利用者ごとに parent + child を生成する', () => {
    const result = buildHandoffExceptions({
      handoffs: [
        makeHandoff({ id: '101', userId: 'U-001' }),
        makeHandoff({ id: '102', userId: 'U-001', status: '対応中' }),
      ],
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: 'handoff-user-U-001',
      category: 'critical-handoff',
      targetUserId: 'U-001',
      severity: 'critical',
    });
    expect(result[1]).toMatchObject({
      id: 'handoff-101',
      parentId: 'handoff-user-U-001',
      category: 'critical-handoff',
      severity: 'critical',
    });
    expect(result[2]).toMatchObject({
      id: 'handoff-102',
      parentId: 'handoff-user-U-001',
      category: 'critical-handoff',
      severity: 'high',
    });
  });

  it('child deep link は handoffId と date を含む', () => {
    const result = buildHandoffExceptions({
      handoffs: [makeHandoff({ id: '205', createdAt: '2026-03-21T11:30:00Z' })],
    });

    const child = result.find((item) => item.parentId);
    expect(child?.actionPath).toBe('/handoff-timeline?range=day&date=2026-03-21&handoffId=205');
  });

  it('1利用者あたり child は最大5件（既定）', () => {
    const handoffs = Array.from({ length: 7 }, (_, index) =>
      makeHandoff({
        id: String(300 + index),
        createdAt: `2026-03-25T0${Math.min(index, 9)}:00:00Z`,
      }),
    );

    const result = buildHandoffExceptions({ handoffs });
    const children = result.filter((item) => item.parentId);
    const parent = result.find((item) => !item.parentId);

    expect(children).toHaveLength(5);
    expect(parent?.description).toContain('他 2 件');
  });

  it('完了/確認済または userId 不明のデータはスキップする', () => {
    const result = buildHandoffExceptions({
      handoffs: [
        makeHandoff({ id: '401', userId: 'U-001', status: '未対応' }),
        makeHandoff({ id: '402', userId: 'U-001', status: '完了' }),
        makeHandoff({ id: '403', userId: 'U-001', status: '確認済' }),
        makeHandoff({ id: '404', userId: '' }),
      ],
    });

    const childIds = result.filter((item) => item.parentId).map((item) => item.id);
    expect(childIds).toEqual(['handoff-401']);
  });

  it('userNames があれば表示名を parent/child に反映する', () => {
    const result = buildHandoffExceptions({
      handoffs: [makeHandoff({ id: '501', userId: 'U-777', userName: '匿名' })],
      userNames: { 'U-777': '田中 花子' },
    });

    expect(result[0]?.targetUser).toBe('田中 花子');
    expect(result[1]?.targetUser).toBe('田中 花子');
    expect(result[0]?.title).toContain('田中 花子');
  });
});
