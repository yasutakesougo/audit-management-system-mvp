/**
 * sanitizeForm — Phase 5 テスト
 *
 * sanitizeForm() に対する以下の動作を検証:
 *   1. goals が存在する場合はそのまま保持
 *   2. goals が空/未定義の場合は空配列のまま
 *   3. string フィールドのサニタイズが正常動作
 */
import { describe, expect, it } from 'vitest';
import type { SupportPlanForm } from '../../types';
import { sanitizeForm } from '../helpers';

describe('sanitizeForm — Phase 5', () => {
  describe('goals が既に存在する場合', () => {
    it('既存の goals 配列がそのまま保持される', () => {
      const existingGoals = [
        { id: 'g1', type: 'long' as const, label: '既存の長期', text: 'テスト', domains: ['health'] },
        { id: 'g2', type: 'short' as const, label: '既存の短期', text: 'テスト2', domains: [] },
      ];
      const input: Partial<SupportPlanForm> = {
        goals: existingGoals,
      };
      const result = sanitizeForm(input);
      expect(result.goals).toEqual(existingGoals);
      expect(result.goals).toHaveLength(2);
    });

    it('空の goals 配列もそのまま保持される', () => {
      const input: Partial<SupportPlanForm> = {
        serviceUserName: '山田太郎',
        goals: [],
      };
      const result = sanitizeForm(input);
      expect(result.goals).toEqual([]);
    });
  });

  describe('goals が未定義の場合', () => {
    it('デフォルト値の空配列が返される', () => {
      const input: Partial<SupportPlanForm> = {
        serviceUserName: '山田太郎',
      };
      const result = sanitizeForm(input);
      expect(result.goals).toEqual([]);
    });

    it('undefined data → 空フォーム（goals は空配列）', () => {
      const result = sanitizeForm(undefined);
      expect(result.goals).toEqual([]);
    });
  });

  describe('string フィールドのサニタイズとの共存', () => {
    it('string フィールドのサニタイズと goals 保持が同時に動作する', () => {
      const goalData = [
        { id: 'g1', type: 'long' as const, label: '長期', text: '自立', domains: [] },
      ];
      const input: Partial<SupportPlanForm> = {
        serviceUserName: '田中花子',
        goals: goalData,
      };
      const result = sanitizeForm(input);
      expect(result.serviceUserName).toBe('田中花子');
      expect(result.goals).toEqual(goalData);
    });

    it('不明なフィールドは無視される', () => {
      const input = {
        serviceUserName: 'テスト',
        unknownField: 'ignored',
      } as Partial<SupportPlanForm>;
      const result = sanitizeForm(input);
      expect(result.serviceUserName).toBe('テスト');
      expect(result.goals).toEqual([]);
    });
  });
});
