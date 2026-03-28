/**
 * ISPCandidateImportSection.spec.tsx — ISP候補取り込みセクションのテスト
 *
 * Issue #10 Phase 2: SupportPlanGuide への接続
 *
 * テスト観点:
 * 1. 候補0件ならセクションが出ない
 * 2. 候補ありならプレビューが出る
 * 3. 「取り込む」で improvementIdeas に追記される
 * 4. 既存テキストがある場合も安全に追記される
 * 5. 同じ候補は再取り込みされない
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SuggestionAction } from '@/features/daily/domain/legacy/suggestionAction';
import {
  collectISPCandidates,
  isAlreadyInImprovementIdeas,
  appendCandidateToImprovementIdeas,
} from '@/features/daily/domain/mappers/ispCandidateMapper';

// ─── 1. Pure function ベースのテスト ─────────────────────
// ISPCandidateImportSection の核心ロジックは pure function なので、
// React コンポーネントのレンダリングではなく関数レベルでテストする。

/** テスト用のヘルパー: accepted SuggestionAction を生成 */
function makeAcceptedAction(overrides: Partial<SuggestionAction> = {}): SuggestionAction {
  return {
    ruleId: 'rule-co-occurrence-01',
    category: 'co-occurrence' as SuggestionAction['category'],
    message: '午前中に集中力が低下するパターンが見られます',
    evidence: '月曜 3 回でパニック発生',
    action: 'accept',
    timestamp: '2026-03-14T10:00:00Z',
    userId: 'user-001',
    ...overrides,
  };
}

describe('ISPCandidateImportSection ロジック', () => {
  describe('候補が0件の場合', () => {
    it('空の acceptedSuggestions からは候補が生成されない', () => {
      const candidates = collectISPCandidates([], []);
      expect(candidates).toHaveLength(0);
    });

    it('dismiss のみの acceptedSuggestions からは候補が生成されない', () => {
      const actions: SuggestionAction[] = [
        makeAcceptedAction({ action: 'dismiss' }),
      ];
      const candidates = collectISPCandidates(actions, []);
      expect(candidates).toHaveLength(0);
    });
  });

  describe('候補が生成される場合', () => {
    it('accept アクションから候補が生成される', () => {
      const actions: SuggestionAction[] = [
        makeAcceptedAction({ action: 'accept' }),
      ];
      const candidates = collectISPCandidates(actions, []);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].text).toContain('午前中に集中力が低下する');
      expect(candidates[0].userId).toBe('user-001');
    });

    it('複数の accept アクションから複数の候補が生成される', () => {
      const actions: SuggestionAction[] = [
        makeAcceptedAction({ ruleId: 'rule-co-occurrence-01', message: '提案A' }),
        makeAcceptedAction({ ruleId: 'rule-slot-bias-02', category: 'slot-bias', message: '提案B' }),
      ];
      const candidates = collectISPCandidates(actions, []);
      expect(candidates).toHaveLength(2);
    });
  });

  describe('improvementIdeas への追記', () => {
    it('空のテキストに安全に追記できる', () => {
      const actions: SuggestionAction[] = [makeAcceptedAction()];
      const candidates = collectISPCandidates(actions, []);
      const result = appendCandidateToImprovementIdeas('', candidates[0]);
      expect(result).toContain('【行動パターンからの候補】');
      expect(result).toContain('午前中に集中力が低下する');
    });

    it('既存テキストがある場合はセパレータ付きで追記される', () => {
      const actions: SuggestionAction[] = [makeAcceptedAction()];
      const candidates = collectISPCandidates(actions, []);
      const existing = '既存の改善メモ内容';
      const result = appendCandidateToImprovementIdeas(existing, candidates[0]);
      expect(result).toContain(existing);
      expect(result).toContain('---');
      expect(result).toContain('午前中に集中力が低下する');
    });

    it('追記されたテキストにはメタ印が含まれる', () => {
      const actions: SuggestionAction[] = [makeAcceptedAction()];
      const candidates = collectISPCandidates(actions, []);
      const result = appendCandidateToImprovementIdeas('', candidates[0]);
      expect(result).toContain('[source:rule=rule-co-occurrence-01 user=user-001]');
    });
  });

  describe('重複防止', () => {
    it('同じ候補が improvementIdeas に既にあれば isAlreadyInImprovementIdeas が true', () => {
      const actions: SuggestionAction[] = [makeAcceptedAction()];
      const candidates = collectISPCandidates(actions, []);
      const text = appendCandidateToImprovementIdeas('', candidates[0]);

      // 同じ ruleId + userId のチェック
      expect(isAlreadyInImprovementIdeas(text, 'rule-co-occurrence-01', 'user-001')).toBe(true);
    });

    it('異なる ruleId なら isAlreadyInImprovementIdeas が false', () => {
      const actions: SuggestionAction[] = [makeAcceptedAction()];
      const candidates = collectISPCandidates(actions, []);
      const text = appendCandidateToImprovementIdeas('', candidates[0]);

      expect(isAlreadyInImprovementIdeas(text, 'rule-different-01', 'user-001')).toBe(false);
    });

    it('3層フィルタ: 生成→追記→UIフィルタの一貫性', () => {
      const actions: SuggestionAction[] = [
        makeAcceptedAction({ ruleId: 'rule-01', message: '候補A' }),
        makeAcceptedAction({ ruleId: 'rule-02', message: '候補B' }),
      ];

      // (1) 候補生成
      const candidates = collectISPCandidates(actions, []);
      expect(candidates).toHaveLength(2);

      // (2) 1件目だけ追記
      let text = appendCandidateToImprovementIdeas('', candidates[0]);

      // (3) UI フィルタ: 追記済みの候補を除外
      const newCandidates = candidates.filter(
        c => !isAlreadyInImprovementIdeas(text, c.sourceRuleId, c.userId),
      );
      expect(newCandidates).toHaveLength(1);
      expect(newCandidates[0].sourceRuleId).toBe('rule-02');

      // (4) 残りの候補を追記
      text = appendCandidateToImprovementIdeas(text, newCandidates[0]);

      // (5) 全候補が追記済み → フィルタ結果は0件
      const remaining = candidates.filter(
        c => !isAlreadyInImprovementIdeas(text, c.sourceRuleId, c.userId),
      );
      expect(remaining).toHaveLength(0);
    });
  });

  describe('まとめて取り込みシミュレーション', () => {
    let mockOnFieldChange: (...args: unknown[]) => void;
    let mockSetToast: (...args: unknown[]) => void;

    beforeEach(() => {
      mockOnFieldChange = vi.fn();
      mockSetToast = vi.fn();
    });

    it('まとめて取り込みボタンのロジックが正しく動作する', () => {
      const actions: SuggestionAction[] = [
        makeAcceptedAction({ ruleId: 'rule-01', message: '候補A' }),
        makeAcceptedAction({ ruleId: 'rule-02', category: 'slot-bias' as SuggestionAction['category'], message: '候補B' }),
        makeAcceptedAction({ ruleId: 'rule-03', message: '候補C' }),
      ];

      const candidates = collectISPCandidates(actions, []);
      const currentIdeas = '既存のメモ';

      // ISPCandidateImportSection の handleImport と同じロジック
      const newCandidates = candidates.filter(
        c => !isAlreadyInImprovementIdeas(currentIdeas, c.sourceRuleId, c.userId),
      );
      expect(newCandidates.length).toBeGreaterThan(0);

      let text = currentIdeas;
      for (const candidate of newCandidates) {
        text = appendCandidateToImprovementIdeas(text, candidate);
      }

      mockOnFieldChange('improvementIdeas', text);
      mockSetToast({
        open: true,
        message: `${newCandidates.length}件の候補を改善メモに取り込みました`,
        severity: 'success',
      });

      expect(mockOnFieldChange).toHaveBeenCalledOnce();
      expect(mockOnFieldChange).toHaveBeenCalledWith('improvementIdeas', text);
      expect(mockSetToast).toHaveBeenCalledWith(
        expect.objectContaining({
          open: true,
          severity: 'success',
        }),
      );

      // 追記後のテキストに全候補のメタ印が含まれる
      expect(text).toContain('[source:rule=rule-01 user=user-001]');
      expect(text).toContain('[source:rule=rule-02 user=user-001]');
      expect(text).toContain('[source:rule=rule-03 user=user-001]');
    });
  });
});
