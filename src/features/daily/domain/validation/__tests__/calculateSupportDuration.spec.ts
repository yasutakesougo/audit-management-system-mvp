import { describe, it, expect } from 'vitest';
import { calculateSupportDuration } from '../calculateSupportDuration';

describe('calculateSupportDuration', () => {
  it('同日の通常ケースを正しく計算できる（1時間）', () => {
    expect(calculateSupportDuration('10:00', '11:00')).toBe(60);
  });

  it('同日の通常ケースを正しく計算できる（端数）', () => {
    expect(calculateSupportDuration('09:15', '10:45')).toBe(90);
  });

  it('開始と終了が同じ場合は0分になる', () => {
    expect(calculateSupportDuration('10:00', '10:00')).toBe(0);
  });

  describe('日跨ぎの扱い', () => {
    it('終了が開始より前の場合、デフォルトでは日跨ぎ禁止とみなし0を返す', () => {
      expect(calculateSupportDuration('23:00', '01:00')).toBe(0);
    });

    it('allowCrossDay=true の場合、終了が開始より前なら翌日扱い（24h加算）で計算する', () => {
      expect(calculateSupportDuration('23:00', '01:00', { allowCrossDay: true })).toBe(120);
    });
  });

  describe('不正な入力の扱い', () => {
    it('null が渡された場合は0を返す', () => {
      expect(calculateSupportDuration(null, '11:00')).toBe(0);
      expect(calculateSupportDuration('10:00', null)).toBe(0);
    });

    it('undefined が渡された場合は0を返す', () => {
      expect(calculateSupportDuration(undefined, '11:00')).toBe(0);
      expect(calculateSupportDuration('10:00', undefined)).toBe(0);
    });

    it('空文字が渡された場合は0を返す', () => {
      expect(calculateSupportDuration('', '11:00')).toBe(0);
    });

    it('形式が不正な場合は0を返す', () => {
      expect(calculateSupportDuration('invalid', '11:00')).toBe(0);
      expect(calculateSupportDuration('25:00', '11:00')).toBe(0); // 24h超えの不正値
    });
  });
});
