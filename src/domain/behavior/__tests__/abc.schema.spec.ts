import { describe, expect, it } from 'vitest';
import { abcRecordSchema } from '../abc.schema';

describe('abcRecordSchema', () => {
  it('intensity: 0 と 5 を許容し境界値で受け付ける', () => {
    const zero = {
      id: 'abc-1',
      userId: 'u-1',
      recordedAt: '2026-06-12T00:00:00.000Z',
      antecedent: '',
      antecedentTags: [],
      behavior: '',
      consequence: '',
      intensity: 0,
    };

    const five = {
      ...zero,
      id: 'abc-2',
      intensity: 5,
    };

    expect(() => abcRecordSchema.parse(zero)).not.toThrow();
    expect(() => abcRecordSchema.parse(five)).not.toThrow();
  });

  it('durationMinutes が負数のとき検証に失敗する', () => {
    expect(() =>
      abcRecordSchema.parse({
        id: 'abc-3',
        userId: 'u-1',
        recordedAt: '2026-06-12T00:00:00.000Z',
        antecedent: '',
        antecedentTags: [],
        behavior: '',
        consequence: '',
        intensity: 3,
        durationMinutes: -1,
      }),
    ).toThrow();
  });
});