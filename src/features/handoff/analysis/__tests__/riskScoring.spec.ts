import { describe, it, expect } from 'vitest';
import { computeRiskScores } from '../riskScoring';
import type { HandoffRecord } from '../../handoffTypes';

// ── テストヘルパー ──

let idCounter = 0;
function resetIds() { idCounter = 0; }

function makeRecord(
  overrides: Partial<HandoffRecord> & { createdAt: string },
): HandoffRecord {
  idCounter++;
  return {
    id: idCounter,
    title: 'テスト',
    message: 'テストメッセージ',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdByName: '職員A',
    isDraft: false,
    ...overrides,
  };
}

const BASE = new Date('2026-03-16T12:00:00Z');

// ────────────────────────────────────────────────────────────
// 基本動作
// ────────────────────────────────────────────────────────────

describe('computeRiskScores', () => {
  describe('基本動作', () => {
    it('returns empty result for empty records', () => {
      const result = computeRiskScores([]);

      expect(result.scores).toEqual([]);
      expect(result.totalUsersEvaluated).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.byLevel).toEqual({ low: 0, moderate: 0, high: 0, critical: 0 });
    });

    it('returns score for single quiet user', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: 'その他' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores).toHaveLength(1);
      expect(result.scores[0].userCode).toBe('U001');
      // alerts なし + patterns なし + volume 少 → low score
      expect(result.scores[0].score).toBeLessThan(15);
      expect(result.scores[0].level).toBe('low');
    });
  });

  // ────────────────────────────────────────────────────────────
  // スコアの構成要素
  // ────────────────────────────────────────────────────────────

  describe('breakdown', () => {
    it('includes alertScore from triggered alerts', () => {
      resetIds();
      // 3日連続体調 → consecutive-health-3d (warning: 8pts)
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].breakdown.alertScore).toBeGreaterThan(0);
      expect(result.scores[0].alerts.length).toBeGreaterThan(0);
    });

    it('includes patternScore from detected patterns', () => {
      resetIds();
      // 5回の体調 → same-category-repeat (high confidence: 10pts)
      const records = Array.from({ length: 5 }, (_, i) =>
        makeRecord({ createdAt: `2026-03-${16 - i}T10:00:00Z`, category: '体調' }),
      );

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].breakdown.patternScore).toBeGreaterThan(0);
      expect(result.scores[0].patterns.length).toBeGreaterThan(0);
    });

    it('includes volumeScore based on handoff count', () => {
      resetIds();
      const records = Array.from({ length: 10 }, (_, i) =>
        makeRecord({
          createdAt: `2026-03-${String(16 - (i % 7)).padStart(2, '0')}T${10 + i}:00:00Z`,
          category: ['体調', '行動面', '良かったこと', 'その他'][i % 4] as HandoffRecord['category'],
        }),
      );

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].breakdown.volumeScore).toBeGreaterThan(0);
    });

    it('caps total score at 100', () => {
      resetIds();
      // 大量のアラート + パターンを生成
      const records: HandoffRecord[] = [];
      for (let i = 0; i < 20; i++) {
        records.push(makeRecord({
          createdAt: `2026-03-${String(16 - (i % 7)).padStart(2, '0')}T10:00:00Z`,
          category: '体調',
          severity: '重要',
          status: '未対応',
        }));
      }

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].score).toBeLessThanOrEqual(100);
    });
  });

  // ────────────────────────────────────────────────────────────
  // リスクレベル判定
  // ────────────────────────────────────────────────────────────

  describe('risk levels', () => {
    it('assigns critical level for high-risk user', () => {
      resetIds();
      // 家族連絡未対応(critical: 25) + 3日連続体調(warning: 8) + パターン + ボリューム
      const records = [
        // 3日連続体調
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        // 家族連絡未対応
        makeRecord({ createdAt: '2026-03-10T10:00:00Z', category: '家族連絡', status: '未対応' }),
        // 行動面3回
        makeRecord({ createdAt: '2026-03-16T14:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-14T14:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-12T14:00:00Z', category: '行動面' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].level).toBe('critical');
      expect(result.scores[0].score).toBeGreaterThanOrEqual(60);
    });

    it('assigns low level for quiet user', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '良かったこと' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].level).toBe('low');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 多利用者
  // ────────────────────────────────────────────────────────────

  describe('多利用者', () => {
    it('scores each user independently', () => {
      resetIds();
      const records = [
        // U001: 3日体調連続（高リスク）
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        // U002: 良かったこと1件（低リスク）
        makeRecord({ userCode: 'U002', createdAt: '2026-03-16T10:00:00Z', category: '良かったこと' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores).toHaveLength(2);
      expect(result.scores[0].userCode).toBe('U001'); // 高スコアが先
      expect(result.scores[0].score).toBeGreaterThan(result.scores[1].score);
    });

    it('counts byLevel correctly', () => {
      resetIds();
      const records = [
        // U001: 高リスク
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-10T10:00:00Z', category: '家族連絡', status: '未対応' }),
        // U002: 低リスク
        makeRecord({ userCode: 'U002', createdAt: '2026-03-16T10:00:00Z', category: '良かったこと' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.totalUsersEvaluated).toBe(2);
      // U001 は少なくとも moderate 以上、U002 は low
      const levels = result.scores.map(s => s.level);
      expect(levels).toContain('low');
    });
  });

  // ────────────────────────────────────────────────────────────
  // ソート順
  // ────────────────────────────────────────────────────────────

  describe('ソート順', () => {
    it('sorts by score descending', () => {
      resetIds();
      const records = [
        // U002: 低リスク
        makeRecord({ userCode: 'U002', createdAt: '2026-03-16T10:00:00Z', category: '良かったこと' }),
        // U001: 高リスク
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      // 高スコアが先
      for (let i = 1; i < result.scores.length; i++) {
        expect(result.scores[i - 1].score).toBeGreaterThanOrEqual(result.scores[i].score);
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // topSuggestion
  // ────────────────────────────────────────────────────────────

  describe('topSuggestion', () => {
    it('picks suggestion from most severe alert', () => {
      resetIds();
      const records = [
        // family-stale-3d → critical → 管理者へのエスカレーション
        makeRecord({ createdAt: '2026-03-10T10:00:00Z', category: '家族連絡', status: '未対応' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.scores[0].topSuggestion).toContain('管理者');
    });

    it('falls back to pattern-based suggestion', () => {
      resetIds();
      // アラートは発火しないが、unresolved-repeat は検出される
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調', status: '未対応' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調', status: '対応中' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      // パターンがあれば pattern-based、なければデフォルト
      expect(typeof result.scores[0].topSuggestion).toBe('string');
      expect(result.scores[0].topSuggestion.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // averageScore
  // ────────────────────────────────────────────────────────────

  describe('averageScore', () => {
    it('computes rounded average', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: 'その他' }),
        makeRecord({ userCode: 'U002', createdAt: '2026-03-16T10:00:00Z', category: 'その他' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      const expected = Math.round(
        result.scores.reduce((sum, s) => sum + s.score, 0) / result.scores.length,
      );
      expect(result.averageScore).toBe(expected);
    });
  });

  // ────────────────────────────────────────────────────────────
  // エッジケース
  // ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('ignores records with empty userCode', () => {
      resetIds();
      const records = [
        makeRecord({ userCode: '', createdAt: '2026-03-16T10:00:00Z' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z' }),
      ];

      const result = computeRiskScores(records, { baseDate: BASE });

      expect(result.totalUsersEvaluated).toBe(1);
    });
  });
});
