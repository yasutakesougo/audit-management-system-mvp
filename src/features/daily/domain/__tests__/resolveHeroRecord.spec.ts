import { describe, it, expect } from 'vitest';
import type { PersonDaily } from '@/domain/daily/types';
import { resolveHeroRecord } from '../legacy/resolveHeroRecord';

// ─── Factory ────────────────────────────────────────────────────

function makeRecord(
  overrides: Partial<PersonDaily> & { id: number; status: PersonDaily['status'] },
): PersonDaily {
  return {
    userId: String(overrides.id).padStart(3, '0'),
    userName: `User${overrides.id}`,
    date: '2026-03-19',
    reporter: { name: '職員A' },
    draft: { isDraft: overrides.status !== '完了' },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      mealAmount: '完食',
    },
    ...overrides,
  } as PersonDaily;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('resolveHeroRecord', () => {
  it('空配列 → noRecords', () => {
    const result = resolveHeroRecord([]);
    expect(result).toEqual({ kind: 'noRecords' });
  });

  it('全件完了 → allCompleted', () => {
    const records = [
      makeRecord({ id: 1, status: '完了' }),
      makeRecord({ id: 2, status: '完了' }),
      makeRecord({ id: 3, status: '完了' }),
    ];
    const result = resolveHeroRecord(records);
    expect(result).toEqual({ kind: 'allCompleted', total: 3 });
  });

  it('作成中が存在 → 作成中を優先', () => {
    const records = [
      makeRecord({ id: 1, status: '完了' }),
      makeRecord({ id: 2, status: '未作成' }),
      makeRecord({ id: 3, status: '作成中' }),
    ];
    const result = resolveHeroRecord(records);
    expect(result.kind).toBe('next');
    if (result.kind === 'next') {
      expect(result.record.id).toBe(3);
      expect(result.record.status).toBe('作成中');
      expect(result.remaining).toBe(2);
      expect(result.total).toBe(3);
    }
  });

  it('未作成のみ → 最初の未作成', () => {
    const records = [
      makeRecord({ id: 1, status: '完了' }),
      makeRecord({ id: 2, status: '未作成' }),
      makeRecord({ id: 3, status: '未作成' }),
    ];
    const result = resolveHeroRecord(records);
    expect(result.kind).toBe('next');
    if (result.kind === 'next') {
      expect(result.record.id).toBe(2);
      expect(result.record.status).toBe('未作成');
      expect(result.remaining).toBe(2);
    }
  });

  it('作成中が複数 → 最初の作成中を返す', () => {
    const records = [
      makeRecord({ id: 1, status: '作成中' }),
      makeRecord({ id: 2, status: '作成中' }),
      makeRecord({ id: 3, status: '未作成' }),
    ];
    const result = resolveHeroRecord(records);
    expect(result.kind).toBe('next');
    if (result.kind === 'next') {
      expect(result.record.id).toBe(1);
      expect(result.remaining).toBe(3);
      expect(result.total).toBe(3);
    }
  });

  it('1件だけで完了 → allCompleted total=1', () => {
    const records = [makeRecord({ id: 1, status: '完了' })];
    const result = resolveHeroRecord(records);
    expect(result).toEqual({ kind: 'allCompleted', total: 1 });
  });

  it('1件だけで未作成 → next remaining=1', () => {
    const records = [makeRecord({ id: 1, status: '未作成' })];
    const result = resolveHeroRecord(records);
    expect(result.kind).toBe('next');
    if (result.kind === 'next') {
      expect(result.remaining).toBe(1);
      expect(result.total).toBe(1);
    }
  });
});
