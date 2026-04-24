/**
 * ispGoalMapper — unit tests
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanForm } from '@/features/support-plan-guide/types';
import { defaultFormState } from '@/features/support-plan-guide/types';
import { describe, expect, it } from 'vitest';
import type { SpPlanGoalItem } from '../fields';
import {
    batchUpsertGoals,
    formToGoals,
    mapFieldRowToGoalItem,
    normalizeGoalForSP,
    spRowToGoalItem,
} from '../ispGoalMapper';

/* ─── spRowToGoalItem ─── */

describe('spRowToGoalItem', () => {
  it('converts a fully-populated SP row', () => {
    const row: SpPlanGoalItem = {
      Id: 42,
      Title: 'test',
      UserCode: 'U001',
      GoalType: 'long',
      GoalLabel: '長期目標',
      GoalText: '日中活動に参加する',
      Domains: 'health,social',
      PlanPeriod: '2025年4月〜2025年9月',
      PlanStatus: 'confirmed',
      CertExpiry: '2026-05-31',
      SortOrder: 1,
    };
    const goal = spRowToGoalItem(row);
    expect(goal).toEqual({
      id: 'sp-42',
      type: 'long',
      label: '長期目標',
      text: '日中活動に参加する',
      domains: ['health', 'social'],
    });
  });

  it('handles null/undefined Domains as empty array', () => {
    const row: SpPlanGoalItem = {
      Id: 1,
      UserCode: 'U002',
      GoalType: 'short',
      GoalLabel: '短期',
      GoalText: 'test',
      Domains: null,
      PlanStatus: 'draft',
    };
    expect(spRowToGoalItem(row).domains).toEqual([]);
  });

  it('handles missing GoalType → defaults to "support"', () => {
    const row = {
      Id: 3,
      UserCode: 'U003',
      GoalType: undefined,
      GoalLabel: 'label',
      GoalText: 'text',
      PlanStatus: 'draft',
    } as unknown as SpPlanGoalItem;
    expect(spRowToGoalItem(row).type).toBe('support');
  });
});

/* ─── normalizeGoalForSP ─── */

describe('normalizeGoalForSP', () => {
  const baseGoal: GoalItem = {
    id: 'g1',
    type: 'long',
    label: '長期目標',
    text: '日中活動に参加する',
    domains: ['health', 'social'],
  };
  const meta = { planPeriod: '2026年4月〜', planStatus: 'draft' as const, certExpiry: '2027-03-31' };

  it('produces a valid PlanGoalPayload', () => {
    const payload = normalizeGoalForSP(baseGoal, 'U001', meta, 0);
    expect(payload).toEqual({
      UserCode: 'U001',
      GoalType: 'long',
      GoalLabel: '長期目標',
      GoalText: '日中活動に参加する',
      Domains: 'health,social',
      PlanPeriod: '2026年4月〜',
      PlanStatus: 'draft',
      CertExpiry: '2027-03-31',
      SortOrder: 0,
    });
  });

  it('trims label and text', () => {
    const goal: GoalItem = { ...baseGoal, label: '  長期  ', text: '  text  ' };
    const payload = normalizeGoalForSP(goal, 'U001', meta);
    expect(payload.GoalLabel).toBe('長期');
    expect(payload.GoalText).toBe('text');
  });

  it('falls back to type label when label is empty', () => {
    const goal: GoalItem = { ...baseGoal, label: '' };
    expect(normalizeGoalForSP(goal, 'U001', meta).GoalLabel).toBe('長期目標');
  });

  it('handles undefined domains as empty string', () => {
    const goal = { ...baseGoal, domains: undefined } as unknown as GoalItem;
    expect(normalizeGoalForSP(goal, 'U001', meta).Domains).toBe('');
  });

  it('handles null text as empty string', () => {
    const goal = { ...baseGoal, text: null } as unknown as GoalItem;
    expect(normalizeGoalForSP(goal, 'U001', meta).GoalText).toBe('');
  });

  it('falls back invalid type to "support"', () => {
    const goal = { ...baseGoal, type: 'invalid' } as unknown as GoalItem;
    expect(normalizeGoalForSP(goal, 'U001', meta).GoalType).toBe('support');
  });
});

/* ─── formToGoals ─── */

describe('formToGoals', () => {
  it('returns form.goals directly', () => {
    const goalItems: GoalItem[] = [
      { id: 'g1', type: 'long', label: '長期目標', text: '日中活動に参加する', domains: ['health'] },
      { id: 'g2', type: 'short', label: '短期目標①', text: '目標A', domains: [] },
      { id: 'g3', type: 'short', label: '短期目標②', text: '目標B', domains: [] },
      { id: 'g4', type: 'support', label: '日常支援', text: '日常支援1', domains: [] },
    ];
    const form: SupportPlanForm = {
      ...defaultFormState,
      serviceUserName: 'テスト',
      supportLevel: '区分3',
      planPeriod: '2026年4月〜',
      decisionSupport: '意思決定を支援する',
      goals: goalItems,
    };
    const goals = formToGoals(form);

    expect(goals).toHaveLength(4);
    expect(goals).toEqual(goalItems);
  });

  it('returns empty for form with empty goals', () => {
    const form: SupportPlanForm = {
      ...defaultFormState,
      goals: [],
    };
    expect(formToGoals(form)).toHaveLength(0);
  });
});

/* ─── mapFieldRowToGoalItem ─── */

describe('mapFieldRowToGoalItem', () => {
  it('maps a Record<string, unknown> using PLAN_GOAL_FIELDS keys', () => {
    const row: Record<string, unknown> = {
      Id: 10,
      GoalType: 'short',
      GoalLabel: '短期目標①',
      GoalText: '挨拶する',
      Domains: 'language,social',
    };
    const goal = mapFieldRowToGoalItem(row);
    expect(goal.id).toBe('sp-10');
    expect(goal.type).toBe('short');
    expect(goal.domains).toEqual(['language', 'social']);
  });
});

/* ─── batchUpsertGoals ─── */

describe('batchUpsertGoals', () => {
  it('calls spFetch with PATCH for sp-{id} goals and POST for new goals', async () => {
    const fetchCalls: Array<{ path: string; method: string }> = [];
    const mockClient = {
      spFetch: async (path: string, init?: RequestInit) => {
        fetchCalls.push({ path, method: init?.method ?? 'GET' });
        return new Response(null, { status: 204 });
      },
    };

    const goals: GoalItem[] = [
      { id: 'sp-5', type: 'long', label: '長期', text: 'テスト', domains: [] },
      { id: 'new-uuid', type: 'short', label: '短期', text: 'テスト2', domains: ['health'] },
    ];

    await batchUpsertGoals(
      mockClient,
      goals,
      'U001',
      { planPeriod: '2026年', planStatus: 'draft', certExpiry: null },
      'PlanGoal',
    );

    expect(fetchCalls).toHaveLength(2);
    // First call = PATCH (sp-5)
    expect(fetchCalls[0].method).toBe('POST'); // X-HTTP-Method: MERGE
    expect(fetchCalls[0].path).toContain('/items(5)');
    // Second call = POST (new)
    expect(fetchCalls[1].method).toBe('POST');
    expect(fetchCalls[1].path).toContain('/items');
    expect(fetchCalls[1].path).not.toContain('/items(');
  });
});
