import { describe, expect, it } from 'vitest';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import { generateIcebergProposals } from '../proposalGenerator';

const makeItem = (overrides: Partial<IcebergPdcaItem> & { id: string }): IcebergPdcaItem => ({
  userId: 'U001',
  title: 'テスト改善',
  summary: '改善の根拠',
  phase: 'ACT',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  ...overrides,
});

describe('generateIcebergProposals', () => {
  it('ACT アイテムから proposal を1件生成する', () => {
    const items = [makeItem({ id: 'pdca-1' })];
    const proposals = generateIcebergProposals({ userId: 'U001', items });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].userId).toBe('U001');
    expect(proposals[0].source).toBe('iceberg');
    expect(proposals[0].title).toBe('テスト改善');
    expect(proposals[0].rationale).toBe('改善の根拠');
    expect(proposals[0].recommendedAction).toBe('テスト改善');
    expect(proposals[0].status).toBe('proposed');
    expect(proposals[0].evidenceRef).toEqual({
      type: 'pdca-item',
      itemId: 'pdca-1',
      phase: 'ACT',
    });
  });

  it('ACT 以外のフェーズは除外される', () => {
    const items = [
      makeItem({ id: 'p1', phase: 'PLAN' }),
      makeItem({ id: 'p2', phase: 'DO' }),
      makeItem({ id: 'p3', phase: 'CHECK' }),
      makeItem({ id: 'p4', phase: 'ACT' }),
    ];
    const proposals = generateIcebergProposals({ userId: 'U001', items });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].evidenceRef.itemId).toBe('p4');
  });

  it('空配列なら空配列を返す', () => {
    const proposals = generateIcebergProposals({ userId: 'U001', items: [] });
    expect(proposals).toEqual([]);
  });

  it('ACT が複数あれば複数の proposal を生成する', () => {
    const items = [
      makeItem({ id: 'act-1', title: '改善A' }),
      makeItem({ id: 'act-2', title: '改善B' }),
    ];
    const proposals = generateIcebergProposals({ userId: 'U001', items });

    expect(proposals).toHaveLength(2);
    expect(proposals[0].title).toBe('改善A');
    expect(proposals[1].title).toBe('改善B');
  });

  it('summary が空なら fallback の rationale を使う', () => {
    const items = [makeItem({ id: 'p1', summary: '' })];
    const proposals = generateIcebergProposals({ userId: 'U001', items });

    expect(proposals[0].rationale).toBe('（Iceberg PDCA ACT フェーズの分析結果）');
  });

  it('userId が正しく引き継がれる', () => {
    const items = [makeItem({ id: 'p1', userId: 'different-user' })];
    const proposals = generateIcebergProposals({ userId: 'target-user', items });

    // proposal.userId は引数の userId（対象利用者）を使う
    expect(proposals[0].userId).toBe('target-user');
  });

  it('id は一意であること', () => {
    const items = [makeItem({ id: 'p1' })];
    const p1 = generateIcebergProposals({ userId: 'U001', items });
    const p2 = generateIcebergProposals({ userId: 'U001', items });

    expect(p1[0].id).not.toBe(p2[0].id);
  });
});
