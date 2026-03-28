// ---------------------------------------------------------------------------
// toBipOptions unit tests
// ---------------------------------------------------------------------------
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { describe, expect, it } from 'vitest';
import { toBipOptions } from '../toBipOptions';

const basePlan = (overrides: Partial<BehaviorInterventionPlan> = {}): BehaviorInterventionPlan => ({
  id: 'bip-1',
  userId: 'user-1',
  targetBehavior: '他害',
  targetBehaviorNodeId: 'node-1',
  triggerFactors: [],
  strategies: { prevention: '', alternative: '', reactive: '' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('toBipOptions', () => {
  it('returns empty array for empty input', () => {
    expect(toBipOptions([])).toEqual([]);
  });

  it('creates label without triggers when triggerFactors is empty', () => {
    const result = toBipOptions([basePlan()]);
    expect(result).toEqual([
      { id: 'bip-1', label: '他害' },
    ]);
  });

  it('creates label with single trigger', () => {
    const result = toBipOptions([
      basePlan({
        triggerFactors: [{ label: '騒音', nodeId: 'n-1' }],
      }),
    ]);
    expect(result).toEqual([
      { id: 'bip-1', label: '他害（引き金: 騒音）' },
    ]);
  });

  it('creates label with multiple triggers joined by comma', () => {
    const result = toBipOptions([
      basePlan({
        triggerFactors: [
          { label: '騒音', nodeId: 'n-1' },
          { label: '順番待ち', nodeId: 'n-2' },
        ],
      }),
    ]);
    expect(result).toEqual([
      { id: 'bip-1', label: '他害（引き金: 騒音, 順番待ち）' },
    ]);
  });

  it('converts multiple plans', () => {
    const result = toBipOptions([
      basePlan({ id: 'bip-1', targetBehavior: '他害' }),
      basePlan({
        id: 'bip-2',
        targetBehavior: '離席',
        triggerFactors: [{ label: '見通しの立たなさ', nodeId: 'n-3' }],
      }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'bip-1', label: '他害' });
    expect(result[1]).toEqual({ id: 'bip-2', label: '離席（引き金: 見通しの立たなさ）' });
  });
});
