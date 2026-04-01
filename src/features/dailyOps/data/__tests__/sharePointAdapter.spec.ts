/**
 * dailyOps — sharePointAdapter 純関数テスト
 *
 * 対象:
 *   - buildCompositeFilter  複合キー重複判定（欠席二重登録防止の要）
 *   - toIsoDateOnly         SP DateTime → yyyy-MM-dd への切り捨て
 *   - mapFromSp             SP 行 → DailyOpsSignal マッピング
 *
 * テスト設計書: docs/test-design/dailyOps.md
 */
import { describe, it, expect } from 'vitest';

import {
  buildCompositeFilter,
  toIsoDateOnly,
  mapFromSp,
} from '../sharePointAdapter';
import { DAILY_OPS_FIELDS } from '../spSchema';

// ─── 型ヘルパー ──────────────────────────────────────────────────────────────

type CompositeFilterInput = Parameters<typeof buildCompositeFilter>[0];

function makeFilterInput(overrides?: Partial<CompositeFilterInput>): CompositeFilterInput {
  return {
    date: '2026-03-18',
    targetType: 'User',
    targetId: 'U001',
    kind: 'Absent',
    time: undefined,
    ...overrides,
  };
}

// ─── buildCompositeFilter ────────────────────────────────────────────────────

describe('buildCompositeFilter', () => {
  const F = DAILY_OPS_FIELDS;

  describe('time が undefined のとき', () => {
    it('should include null-check clause for the time field', () => {
      const filter = buildCompositeFilter(makeFilterInput({ time: undefined }));
      expect(filter).toContain(`(${F.time} eq null or ${F.time} eq '')`);
    });

    it('should not include an exact time eq clause when time is undefined', () => {
      const filter = buildCompositeFilter(makeFilterInput({ time: undefined }));
      expect(filter).not.toMatch(new RegExp(`${F.time} eq '\\d`));
    });
  });

  describe('time が値を持つとき', () => {
    it('should include exact time eq clause', () => {
      const filter = buildCompositeFilter(makeFilterInput({ time: '09:30' }));
      expect(filter).toContain(`${F.time} eq '09:30'`);
    });

    it('should not include null-check clause when time is provided', () => {
      const filter = buildCompositeFilter(makeFilterInput({ time: '14:00' }));
      expect(filter).not.toContain(`${F.time} eq null`);
    });
  });

  describe('date の正規化', () => {
    it('should use iso date-only form in the filter even when DateTime is given', () => {
      const filter = buildCompositeFilter(makeFilterInput({ date: '2026-03-18T09:00:00Z' }));
      expect(filter).toContain(`${F.date} ge '2026-03-18'`);
      expect(filter).toContain(`${F.date} le '2026-03-18'`);
      expect(filter).not.toContain('T09:00');
    });
  });

  describe('全条件が AND で結合される', () => {
    it('should contain all five clauses joined by " and "', () => {
      const filter = buildCompositeFilter(makeFilterInput({ time: '10:00' }));
      const clauses = filter.split(' and ');
      expect(clauses).toHaveLength(6);
    });

    it('should include date, targetType, targetId, kind in the filter', () => {
      const filter = buildCompositeFilter(makeFilterInput({
        date: '2026-01-01',
        targetType: 'Staff',
        targetId: 'S999',
        kind: 'Late',
      }));
      expect(filter).toContain(`${F.date} ge '2026-01-01'`);
      expect(filter).toContain(`${F.date} le '2026-01-01'`);
      expect(filter).toContain(`${F.targetType} eq 'Staff'`);
      expect(filter).toContain(`${F.targetId} eq 'S999'`);
      expect(filter).toContain(`${F.kind} eq 'Late'`);
    });
  });
});

// ─── toIsoDateOnly ───────────────────────────────────────────────────────────

describe('toIsoDateOnly', () => {
  it('should return date portion of a date-only string unchanged', () => {
    expect(toIsoDateOnly('2026-03-18')).toBe('2026-03-18');
  });

  it('should strip time portion from ISO datetime string with timezone', () => {
    expect(toIsoDateOnly('2026-03-18T09:00:00Z')).toBe('2026-03-18');
  });

  it('should strip time portion from datetime without timezone', () => {
    expect(toIsoDateOnly('2026-03-18T00:00:00')).toBe('2026-03-18');
  });

  it('should return first 10 characters for any input', () => {
    expect(toIsoDateOnly('2026-03-18T23:59:59.999Z')).toBe('2026-03-18');
  });
});

// ─── mapFromSp ───────────────────────────────────────────────────────────────

describe('mapFromSp', () => {
  const F = DAILY_OPS_FIELDS;

  it('should map basic SP item to DailyOpsSignal', () => {
    const item = {
      Id: 42,
      [F.title]: '朝の報告',
      [F.date]: '2026-03-18T00:00:00Z',
      [F.targetType]: 'User',
      [F.targetId]: 'U001',
      [F.kind]: 'Absent',
      [F.time]: null,
      [F.summary]: null,
      [F.status]: 'Active',
      [F.source]: 'Phone',
    };

    const signal = mapFromSp(item);

    expect(signal.id).toBe(42);
    expect(signal.title).toBe('朝の報告');
    expect(signal.date).toBe('2026-03-18');
    expect(signal.targetType).toBe('User');
    expect(signal.targetId).toBe('U001');
    expect(signal.kind).toBe('Absent');
    expect(signal.time).toBeUndefined();
    expect(signal.summary).toBeUndefined();
    expect(signal.status).toBe('Active');
    expect(signal.source).toBe('Phone');
  });

  it('should default status to Active when status field is missing', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18' });
    expect(signal.status).toBe('Active');
  });

  it('should default source to Other when source field is missing', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18' });
    expect(signal.source).toBe('Other');
  });

  it('should set time when time field has a value', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18', [F.time]: '14:30' });
    expect(signal.time).toBe('14:30');
  });

  it('should leave time undefined when time field is null', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18', [F.time]: null });
    expect(signal.time).toBeUndefined();
  });

  it('should set summary when summary field has a value', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18', [F.summary]: '詳細メモ' });
    expect(signal.summary).toBe('詳細メモ');
  });

  it('should map createdAt from Created field', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18', Created: '2026-03-18T09:00:00Z' });
    expect(signal.createdAt).toBe('2026-03-18T09:00:00Z');
  });

  it('should return undefined createdAt when Created is absent', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18' });
    expect(signal.createdAt).toBeUndefined();
  });

  it('should return undefined updatedAt when Modified is absent', () => {
    const signal = mapFromSp({ Id: 1, [F.date]: '2026-03-18' });
    expect(signal.updatedAt).toBeUndefined();
  });
});
