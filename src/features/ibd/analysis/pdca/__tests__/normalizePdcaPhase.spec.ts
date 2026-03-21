/**
 * normalizePdcaPhase — ユニットテスト
 *
 * IcebergPdcaPhase (大文字) → PdcaCyclePhase (小文字) の変換テスト
 */
import { describe, it, expect } from 'vitest';
import { normalizePdcaPhase } from '../types';
import type { IcebergPdcaPhase } from '../types';

describe('normalizePdcaPhase', () => {
  it.each<[IcebergPdcaPhase, string]>([
    ['PLAN', 'plan'],
    ['DO', 'do'],
    ['CHECK', 'check'],
    ['ACT', 'act'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePdcaPhase(input)).toBe(expected);
  });

  it('未知の値に対して plan にフォールバック', () => {
    // @ts-expect-error — 意図的に不正な値を渡すテスト
    expect(normalizePdcaPhase('UNKNOWN')).toBe('plan');
  });
});
