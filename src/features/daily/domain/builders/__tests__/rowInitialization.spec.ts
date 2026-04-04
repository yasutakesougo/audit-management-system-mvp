import { describe, expect, it } from 'vitest';
import type { UserRowData } from '../../../hooks/view-models/useTableDailyRecordForm';
import { syncRowsWithSelectedUsers } from '../rowInitialization';

const makeRow = (overrides: Partial<UserRowData> = {}): UserRowData => ({
  userId: 'u1',
  userName: 'u1',
  amActivity: '',
  pmActivity: '',
  lunchAmount: '',
  problemBehavior: {
    selfHarm: false,
    otherInjury: false,
    loudVoice: false,
    pica: false,
    other: false,
  },
  specialNotes: '',
  behaviorTags: [],
  ...overrides,
});

describe('syncRowsWithSelectedUsers (builders)', () => {
  it('既存行のコード表示名を解決済み氏名で上書きする', () => {
    const result = syncRowsWithSelectedUsers(
      [makeRow({ userId: 'u1', userName: 'u1', amActivity: '入力済み' })],
      [{ userId: 'u1', name: '田中 太郎' }],
      ['u1'],
    );

    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe('田中 太郎');
    expect(result[0].amActivity).toBe('入力済み');
  });
});
