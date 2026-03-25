import { describe, expect, it } from 'vitest';
import type { ActionSuggestion } from '@/features/action-engine/domain/types';
import { buildCorrectiveActionExceptions } from '../buildCorrectiveActionExceptions';

function makeSuggestion(
  overrides: Partial<ActionSuggestion> & { stableId: string; targetUserId?: string },
): ActionSuggestion {
  return {
    id: `runtime-${overrides.stableId}`,
    stableId: overrides.stableId,
    type: 'assessment_update',
    priority: 'P2',
    targetUserId: overrides.targetUserId ?? 'user-001',
    title: '提案',
    reason: '理由',
    evidence: {
      metric: 'metric',
      currentValue: 1,
      threshold: 2,
      period: '7d',
    },
    cta: {
      label: '確認する',
      route: '/assessment',
    },
    createdAt: '2026-03-25T09:00:00Z',
    ruleId: 'rule-id',
    ...overrides,
  };
}

describe('buildCorrectiveActionExceptions', () => {
  it('利用者ごとに parent + child を生成する', () => {
    const result = buildCorrectiveActionExceptions({
      suggestions: [
        makeSuggestion({ stableId: 's-1', targetUserId: 'user-001', priority: 'P1' }),
        makeSuggestion({ stableId: 's-2', targetUserId: 'user-001', priority: 'P2' }),
      ],
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: 'corrective-user-user-001',
      category: 'corrective-action',
      severity: 'high',
      targetUserId: 'user-001',
    });
    expect(result[1]).toMatchObject({
      id: 'ae:s-1',
      parentId: 'corrective-user-user-001',
      stableId: 's-1',
    });
    expect(result[2]).toMatchObject({
      id: 'ae:s-2',
      parentId: 'corrective-user-user-001',
      stableId: 's-2',
    });
  });

  it('子例外は priority 昇順（P0→P1→P2）で並ぶ', () => {
    const result = buildCorrectiveActionExceptions({
      suggestions: [
        makeSuggestion({ stableId: 's-p2', priority: 'P2' }),
        makeSuggestion({ stableId: 's-p0', priority: 'P0' }),
        makeSuggestion({ stableId: 's-p1', priority: 'P1' }),
      ],
    });

    const childStableIds = result
      .filter((item) => item.parentId)
      .map((item) => item.stableId);

    expect(childStableIds).toEqual(['s-p0', 's-p1', 's-p2']);
  });

  it('1利用者あたり child は最大5件（既定）', () => {
    const suggestions = Array.from({ length: 8 }, (_, i) =>
      makeSuggestion({
        stableId: `s-${i + 1}`,
        priority: i === 0 ? 'P0' : 'P2',
        createdAt: `2026-03-25T0${Math.min(i, 9)}:00:00Z`,
      }),
    );

    const result = buildCorrectiveActionExceptions({ suggestions });
    const children = result.filter((item) => item.parentId);
    const parent = result.find((item) => !item.parentId);

    expect(children).toHaveLength(5);
    expect(parent?.description).toContain('他 3 件');
  });

  it('deep link（actionPath）は child 側に保持される', () => {
    const result = buildCorrectiveActionExceptions({
      suggestions: [
        makeSuggestion({
          stableId: 's-link',
          cta: {
            label: '計画を開く',
            route: '/planning?tab=weekly',
          },
        }),
      ],
    });

    const child = result.find((item) => item.parentId);
    expect(child?.actionPath).toBe('/planning?tab=weekly');
    expect(child?.actionLabel).toBe('計画を開く');
  });

  it('targetUserId が空の提案は安全にスキップする', () => {
    const result = buildCorrectiveActionExceptions({
      suggestions: [
        makeSuggestion({ stableId: 'valid-1', targetUserId: 'user-001' }),
        makeSuggestion({ stableId: 'invalid-1', targetUserId: '' }),
      ],
    });

    const stableIds = result.map((item) => item.stableId).filter(Boolean);
    expect(stableIds).toEqual(['valid-1']);
  });

  it('userNames が与えられた場合は表示名を parent/child に反映する', () => {
    const result = buildCorrectiveActionExceptions({
      suggestions: [makeSuggestion({ stableId: 's-1', targetUserId: 'user-777' })],
      userNames: { 'user-777': '田中 花子' },
    });

    expect(result[0]?.targetUser).toBe('田中 花子');
    expect(result[1]?.targetUser).toBe('田中 花子');
    expect(result[0]?.title).toContain('田中 花子');
  });
});
