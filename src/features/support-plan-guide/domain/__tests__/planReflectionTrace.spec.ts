import { describe, expect, it } from 'vitest';
import { buildReflectionTraces } from '../planReflectionTrace';
import type { SupportChangeProposal } from '../proposalTypes';

const makeProposal = (overrides: Partial<SupportChangeProposal> & { id: string }): SupportChangeProposal => ({
  userId: 'U001',
  source: 'iceberg',
  title: 'テスト改善',
  rationale: '根拠テキスト',
  recommendedAction: 'テスト改善',
  evidenceRef: { type: 'pdca-item', itemId: 'pdca-1', phase: 'ACT' },
  status: 'proposed',
  createdAt: '2026-03-01T00:00:00Z',
  ...overrides,
});

describe('buildReflectionTraces', () => {
  it('accepted proposal から trace を1件生成する', () => {
    const proposals = [
      makeProposal({ id: 'p1', status: 'accepted', reviewedAt: '2026-03-10T10:00:00Z' }),
    ];
    const traces = buildReflectionTraces(proposals);

    expect(traces).toHaveLength(1);
    expect(traces[0].proposalId).toBe('p1');
    expect(traces[0].userId).toBe('U001');
    expect(traces[0].proposalTitle).toBe('テスト改善');
    expect(traces[0].targetField).toBe('monitoringPlan');
    expect(traces[0].reflectedAt).toBe('2026-03-10T10:00:00Z');
    expect(traces[0].evidenceChain).toEqual({
      pdcaItemId: 'pdca-1',
      source: 'iceberg',
      acceptedAt: '2026-03-10T10:00:00Z',
    });
  });

  it('accepted 以外の proposal は除外される', () => {
    const proposals = [
      makeProposal({ id: 'p1', status: 'proposed' }),
      makeProposal({ id: 'p2', status: 'deferred' }),
      makeProposal({ id: 'p3', status: 'rejected' }),
      makeProposal({ id: 'p4', status: 'accepted', reviewedAt: '2026-03-10T10:00:00Z' }),
    ];
    const traces = buildReflectionTraces(proposals);

    expect(traces).toHaveLength(1);
    expect(traces[0].proposalId).toBe('p4');
  });

  it('空配列なら空配列を返す', () => {
    expect(buildReflectionTraces([])).toEqual([]);
  });

  it('複数の accepted proposal から複数の trace を生成する', () => {
    const proposals = [
      makeProposal({ id: 'p1', status: 'accepted', title: '改善A', reviewedAt: '2026-03-10T10:00:00Z' }),
      makeProposal({ id: 'p2', status: 'accepted', title: '改善B', reviewedAt: '2026-03-11T10:00:00Z' }),
    ];
    const traces = buildReflectionTraces(proposals);

    expect(traces).toHaveLength(2);
    expect(traces[0].proposalTitle).toBe('改善A');
    expect(traces[1].proposalTitle).toBe('改善B');
  });

  it('trace の id は proposal id から派生する', () => {
    const proposals = [
      makeProposal({ id: 'my-proposal-42', status: 'accepted', reviewedAt: '2026-03-10T10:00:00Z' }),
    ];
    const traces = buildReflectionTraces(proposals);
    expect(traces[0].id).toBe('trace-my-proposal-42');
  });
});
