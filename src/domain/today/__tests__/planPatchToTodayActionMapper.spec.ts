import { describe, expect, it } from 'vitest';
import type { PlanPatchForPlan } from '@/domain/isp/planPatch';
import { mapPlanPatchToTodayActionSource } from '../planPatchToTodayActionMapper';

function makePatch(overrides: Partial<PlanPatchForPlan> = {}): PlanPatchForPlan {
  return {
    id: 'patch-1',
    planningSheetId: 'sheet-1',
    baseVersion: '1',
    target: 'plan',
    before: {},
    after: { status: 'revision_pending' },
    reason: '会議結果の反映が必要',
    evidenceIds: ['meeting-1'],
    status: 'needs_update',
    dueAt: '2026-04-15',
    createdAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('mapPlanPatchToTodayActionSource', () => {
  it('maps a pending patch into Today navigate action', () => {
    const result = mapPlanPatchToTodayActionSource({
      patch: makePatch(),
      userId: 'U001',
      userName: '山田太郎',
    });

    expect(result.sourceType).toBe('plan_patch');
    expect(result.title).toContain('計画更新');
    expect(result.payload).toMatchObject({
      patchId: 'patch-1',
      planningSheetId: 'sheet-1',
      userId: 'U001',
      path: '/support-planning-sheet/sheet-1?tab=planning',
    });
  });

  it('marks overdue patch title with deadline breach wording', () => {
    const result = mapPlanPatchToTodayActionSource({
      patch: makePatch({ dueAt: '2026-04-01' }),
      userId: 'U001',
      userName: '山田太郎',
    });

    expect(result.title).toContain('期限超過');
  });
});
