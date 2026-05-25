import { describe, expect, it } from 'vitest';
import {
  parseKioskProcedureMemo,
  serializeKioskProcedureMemo,
} from '../kioskProcedureMemo';

describe('kioskProcedureMemo', () => {
  it('serializes kiosk procedure memo in the existing label format', () => {
    expect(
      serializeKioskProcedureMemo({
        mood: '不安そう',
        action: '声かけ',
        result: '途中で落ち着いた',
        memo: '追加メモ',
      }),
    ).toBe('【様子】不安そう\n【対応】声かけ\n【変化】途中で落ち着いた\n【メモ】追加メモ');
  });

  it('parses the existing label format', () => {
    expect(
      parseKioskProcedureMemo('【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】補足'),
    ).toEqual({
      mood: '落ち着いていた',
      action: '見守り',
      result: '改善した',
      memo: '補足',
    });
  });

  it('treats unlabeled legacy text as free memo', () => {
    expect(parseKioskProcedureMemo('ラベルなしの記録')).toEqual({
      mood: '',
      action: '',
      result: '',
      memo: 'ラベルなしの記録',
    });
  });

  it('keeps multiline free memo content', () => {
    expect(parseKioskProcedureMemo('【様子】不安そう\n【メモ】1行目\n2行目')).toEqual({
      mood: '不安そう',
      action: '',
      result: '',
      memo: '1行目\n2行目',
    });
  });
});
