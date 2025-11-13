import { fromSpChoice, toSpChoice, toStatusEnum } from '@/features/schedule/statusDictionary';
import { describe, expect, it } from 'vitest';

describe('statusDictionary round-trip', () => {
  it('UI raw -> enum -> SP choice -> enum の往復で意味が崩れない', () => {
    const raws = ['予定', '確定', '休み', '早退', '遅刻', 'その他', '申請中', '承認済み'] as const;
    for (const raw of raws) {
      const enumValue = toStatusEnum(raw);
      const spChoice = toSpChoice(enumValue);
      const roundTrip = fromSpChoice(spChoice);
      expect(roundTrip).toBe(enumValue);
    }
  });
});
