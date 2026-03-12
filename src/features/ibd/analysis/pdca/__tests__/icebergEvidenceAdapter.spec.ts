import { describe, expect, it } from 'vitest';
import { buildIcebergEvidence } from '../icebergEvidenceAdapter';
import type { IcebergPdcaItem } from '../types';

const makeItem = (overrides: Partial<IcebergPdcaItem> & { id: string }): IcebergPdcaItem => ({
  userId: 'U001',
  title: 'テスト項目',
  summary: '',
  phase: 'PLAN',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
  ...overrides,
});

describe('buildIcebergEvidence', () => {
  it('items が空なら count=0, bullets=[] を返す', () => {
    const result = buildIcebergEvidence({ userId: 'U001', items: [] });
    expect(result.totalCount).toBe(0);
    expect(result.actCount).toBe(0);
    expect(result.bullets).toEqual([]);
    expect(result.text).toContain('items=0');
  });

  it('ACT フェーズを優先してソートする', () => {
    const items = [
      makeItem({ id: '1', phase: 'PLAN', title: 'A' }),
      makeItem({ id: '2', phase: 'ACT', title: 'B' }),
      makeItem({ id: '3', phase: 'DO', title: 'C' }),
    ];
    const result = buildIcebergEvidence({ userId: 'U001', items });
    expect(result.items[0].phase).toBe('ACT');
    expect(result.bullets[0]).toContain('[改善]');
    expect(result.bullets[1]).toContain('[実行]');
    expect(result.bullets[2]).toContain('[計画]');
  });

  it('actCount は ACT フェーズのみをカウントする', () => {
    const items = [
      makeItem({ id: '1', phase: 'ACT', title: 'A' }),
      makeItem({ id: '2', phase: 'ACT', title: 'B' }),
      makeItem({ id: '3', phase: 'PLAN', title: 'C' }),
    ];
    const result = buildIcebergEvidence({ userId: 'U001', items });
    expect(result.actCount).toBe(2);
    expect(result.totalCount).toBe(3);
  });

  it('bullet に title, phase label, updatedAt の日付部分を含める', () => {
    const items = [
      makeItem({
        id: '1',
        phase: 'CHECK',
        title: '環境調整仮説',
        summary: '照明を暗くする',
        updatedAt: '2026-03-10T12:00:00.000Z',
      }),
    ];
    const result = buildIcebergEvidence({ userId: 'U001', items });
    expect(result.bullets[0]).toContain('[評価]');
    expect(result.bullets[0]).toContain('環境調整仮説');
    expect(result.bullets[0]).toContain('照明を暗くする');
    expect(result.bullets[0]).toContain('2026-03-10');
  });

  it('summary が空なら bullet に含めない', () => {
    const items = [makeItem({ id: '1', phase: 'DO', title: 'テスト' })];
    const result = buildIcebergEvidence({ userId: 'U001', items });
    expect(result.bullets[0]).not.toContain('—');
  });

  it('text にヘッダーとフッターを含む', () => {
    const items = [makeItem({ id: '1', phase: 'ACT', title: 'X' })];
    const result = buildIcebergEvidence({ userId: 'U001', items });
    expect(result.text).toContain('--- Iceberg PDCA Evidence');
    expect(result.text).toContain('--- End of Iceberg Evidence ---');
    expect(result.text).toContain('user=U001');
  });

  it('userId をそのまま返す', () => {
    const result = buildIcebergEvidence({ userId: 'U999', items: [] });
    expect(result.userId).toBe('U999');
  });
});
