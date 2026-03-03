import { describe, expect, it } from 'vitest';
import { migrateV2TextToGoals } from '../goalMigration';
import type { GoalItem } from '../goalTypes';

/** UUIDv4 形式の正規表現 */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('migrateV2TextToGoals', () => {
  /* ─── 1. 空値の処理 ─── */
  describe('空値の処理', () => {
    it('空文字列を渡すと空配列を返す', () => {
      expect(migrateV2TextToGoals('', 'long', '長期目標')).toEqual([]);
    });

    it('空白のみの文字列を渡すと空配列を返す', () => {
      expect(migrateV2TextToGoals('   ', 'long', '長期目標')).toEqual([]);
    });

    it('undefined を渡すと空配列を返す', () => {
      expect(migrateV2TextToGoals(undefined, 'long', '長期目標')).toEqual([]);
    });
  });

  /* ─── 2. 単一行の処理 ─── */
  describe('単一行の処理', () => {
    it('プレフィックスのない単一行: 配列長1, サフィックスなし, text がそのまま, domains が空', () => {
      const result = migrateV2TextToGoals('自立した生活を送る', 'long', '長期目標');

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('長期目標');        // サフィックスなし
      expect(result[0].text).toBe('自立した生活を送る');
      expect(result[0].domains).toEqual([]);
    });
  });

  /* ─── 3. 複数行とプレフィックス除去の処理 ─── */
  describe('複数行とプレフィックス除去', () => {
    const input = '1. 目標A\n・ 目標B\n　- 目標C';
    const result: GoalItem[] = migrateV2TextToGoals(input, 'short', '短期目標');


    it('配列の長さが 3 である', () => {
      expect(result).toHaveLength(3);
    });

    it('各要素の text からプレフィックスが除去されている', () => {
      expect(result[0].text).toBe('目標A');
      expect(result[1].text).toBe('目標B');
      expect(result[2].text).toBe('目標C');
    });

    it('label に連番サフィックス (①②③) が正しく付与されている', () => {
      expect(result[0].label).toBe('短期目標①');
      expect(result[1].label).toBe('短期目標②');
      expect(result[2].label).toBe('短期目標③');
    });
  });

  /* ─── 4. UUID の検証 ─── */
  describe('UUID の検証', () => {
    it('すべての id が有効な UUIDv4 形式である', () => {
      const result = migrateV2TextToGoals('行A\n行B\n行C', 'long', '長期目標');

      for (const item of result) {
        expect(item.id).toMatch(UUID_V4_RE);
      }
    });

    it('すべての id が一意である', () => {
      const result = migrateV2TextToGoals('行A\n行B\n行C', 'long', '長期目標');

      const ids = result.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  /* ─── 5. 型のマッピング ─── */
  describe('型のマッピング', () => {
    const types = ['long', 'short', 'support'] as const;

    for (const goalType of types) {
      it(`type="${goalType}" が各アイテムに正しくセットされる`, () => {
        const result = migrateV2TextToGoals('テスト目標', goalType, 'ラベル');

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe(goalType);
      });
    }
  });
});
