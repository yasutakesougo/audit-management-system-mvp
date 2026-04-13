import { beforeEach, describe, expect, it } from 'vitest';

import type { ABCRecord } from '@/domain/behavior';
import { localBehaviorObservationRepository } from '../localBehaviorObservationRepository';

function makeRecord(overrides: Partial<ABCRecord> = {}): ABCRecord {
  return {
    id: 'abc-1',
    userId: 'U-001',
    recordedAt: '2026-04-13T09:00:00.000Z',
    antecedent: '予定変更',
    antecedentTags: ['予定の変更'],
    behavior: '大声を出した',
    consequence: '視覚提示で再説明',
    intensity: 3,
    ...overrides,
  };
}

describe('localBehaviorObservationRepository', () => {
  beforeEach(() => {
    localBehaviorObservationRepository.clearAll();
  });

  it('add/listByUser/listAll で記録を保持できる', () => {
    localBehaviorObservationRepository.add(makeRecord({ id: 'abc-1', userId: 'U-001' }));
    localBehaviorObservationRepository.add(makeRecord({ id: 'abc-2', userId: 'U-002' }));

    const userRecords = localBehaviorObservationRepository.listByUser('U-001');
    const allRecords = localBehaviorObservationRepository.listAll();

    expect(userRecords).toHaveLength(1);
    expect(userRecords[0].id).toBe('abc-1');
    expect(allRecords).toHaveLength(2);
  });

  it('recordedAt の降順で返す', () => {
    localBehaviorObservationRepository.add(
      makeRecord({ id: 'abc-old', recordedAt: '2026-04-13T08:00:00.000Z' }),
    );
    localBehaviorObservationRepository.add(
      makeRecord({ id: 'abc-new', recordedAt: '2026-04-13T10:00:00.000Z' }),
    );

    const allRecords = localBehaviorObservationRepository.listAll();
    expect(allRecords[0].id).toBe('abc-new');
    expect(allRecords[1].id).toBe('abc-old');
  });

  it('不正なレコードは add で reject する', () => {
    expect(() =>
      localBehaviorObservationRepository.add(
        makeRecord({ recordedAt: 'not-an-iso-string' as unknown as string }),
      ),
    ).toThrow(/Invalid ABCRecord/);
  });
});
