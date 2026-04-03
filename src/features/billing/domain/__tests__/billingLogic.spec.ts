import { describe, expect, it } from 'vitest';
import { FIELD_MAP_BILLING_ORDERS as F } from '@/sharepoint/fields';
import { mapToBillingOrder, safeParseNumber, safeParseString } from '../billingLogic';

describe('billingLogic', () => {
  // ─── safeParseString ──────────────────────────────────────
  describe('safeParseString', () => {
    it('文字列表現を安全に入出力する (null/undefined等は空文字)', () => {
      // Normal
      expect(safeParseString('hello')).toBe('hello');
      // Numbers are cast to string representation
      expect(safeParseString(123)).toBe('123');
      // Fallbacks
      expect(safeParseString(null)).toBe('');
      expect(safeParseString(undefined)).toBe('');
      expect(safeParseString('')).toBe('');
      // Object fallback observation
      expect(safeParseString({})).toBe('[object Object]');
    });
  });

  // ─── safeParseNumber ──────────────────────────────────────
  describe('safeParseNumber', () => {
    it('正常な数値、および前後の空白が含まれた数値文字列も正しくパースすること', () => {
      expect(safeParseNumber(150)).toBe(150);
      expect(safeParseNumber('150')).toBe(150);
      expect(safeParseNumber('  150  ')).toBe(150);
    });

    it('仕様外の入力(NaN等)に対してクラッシュせず 0 へフォールバックすること', () => {
      expect(safeParseNumber('abc')).toBe(0); // NaN -> 0
      expect(safeParseNumber(undefined)).toBe(0); // NaN -> 0
      expect(safeParseNumber(null)).toBe(0); // Number(null) is 0
      expect(safeParseNumber('')).toBe(0); // Number('') is 0
      expect(safeParseNumber('   ')).toBe(0);
      expect(safeParseNumber(NaN)).toBe(0);
      expect(safeParseNumber(Infinity)).toBe(0);
    });

    it('現状仕様の観測固定: 負数は 0 に丸められずそのまま維持されること', () => {
      expect(safeParseNumber(-150)).toBe(-150);
      expect(safeParseNumber('-1')).toBe(-1);
    });
  });

  // ─── mapToBillingOrder ────────────────────────────────────
  describe('mapToBillingOrder', () => {
    it('外部のSpItem(DTO)が全てのプロパティに正しくマッピングされること', () => {
      const mockItem = {
        [F.id]: 99,
        [F.orderDate]: '2026-03-25',
        [F.ordererCode]: 'U001',
        [F.ordererName]: 'テスト太郎',
        [F.orderCount]: 2,
        [F.served]: '提供済',
        [F.item]: 'コーヒー',
        [F.sugar]: '多め',
        [F.milk]: 'なし',
        [F.drinkPrice]: 100,
      };

      const result = mapToBillingOrder(mockItem, {});

      expect(result.id).toBe(99);
      expect(result.orderDate).toBe('2026-03-25');
      expect(result.ordererCode).toBe('U001');
      expect(result.ordererName).toBe('テスト太郎');
      expect(result.orderCount).toBe(2);
      expect(result.served).toBe('提供済');
      expect(result.item).toBe('コーヒー');
      expect(result.sugar).toBe('多め');
      expect(result.milk).toBe('なし');
      expect(result.drinkPrice).toBe(100);
    });

    it('SharePoint特有のプロパティ揺らぎ(Id, ID, Titleフォールバック)を吸収できること', () => {
      const mockItem1 = { 'Id': 100, 'Title': '日付1' };
      const mockItem2 = { 'ID': 101 };

      const result1 = mapToBillingOrder(mockItem1, {});
      expect(result1.id).toBe(100);
      expect(result1.orderDate).toBe('日付1'); // Title が orderDate へ落ちる仕様

      const result2 = mapToBillingOrder(mockItem2, {});
      expect(result2.id).toBe(101);
      expect(result2.orderDate).toBe(''); // TitleもF.orderDateも無い場合は空文字
    });

    it('完全欠損(空オブジェクト)からの防衛: 後続計算がクラッシュしない安全な初期値が生成されること', () => {
      const emptyItem = {};
      const result = mapToBillingOrder(emptyItem, {});

      expect(result.id).toBe(0);
      expect(result.orderCount).toBe(0);
      expect(result.drinkPrice).toBe(0);
      expect(result.orderDate).toBe('');
      expect(result.ordererName).toBe('');
      expect(result.item).toBe('');
      expect(result.sugar).toBe('');
    });
  });
});
