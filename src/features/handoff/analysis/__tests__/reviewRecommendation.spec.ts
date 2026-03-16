/**
 * reviewRecommendation.spec.ts — 見直し提案生成のユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { buildReviewRecommendations } from '../reviewRecommendation';
import type { RiskScoringResult, UserRiskScore } from '../riskScoring';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeUserScore(overrides: Partial<UserRiskScore>): UserRiskScore {
  return {
    userCode: 'U001',
    userDisplayName: '田中太郎',
    score: 0,
    level: 'low',
    breakdown: { alertScore: 0, patternScore: 0, volumeScore: 0 },
    alerts: [],
    patterns: [],
    totalHandoffs: 5,
    topSuggestion: '特に緊急の対応は不要です',
    ...overrides,
  };
}

function makeRiskResult(scores: UserRiskScore[]): RiskScoringResult {
  const byLevel = { low: 0, moderate: 0, high: 0, critical: 0 } as Record<string, number>;
  for (const s of scores) byLevel[s.level]++;
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  return {
    scores,
    byLevel: byLevel as RiskScoringResult['byLevel'],
    averageScore: scores.length > 0 ? Math.round(totalScore / scores.length) : 0,
    totalUsersEvaluated: scores.length,
  };
}

const BASE_DATE = new Date('2026-03-16T12:00:00Z');

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('buildReviewRecommendations', () => {
  describe('urgency 判定', () => {
    it('score >= 60 → urgent', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 65, level: 'critical' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].urgency).toBe('urgent');
    });

    it('score >= 35 → recommended', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 40, level: 'high' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations[0].urgency).toBe('recommended');
    });

    it('score >= 15 → suggested', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 20, level: 'moderate' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations[0].urgency).toBe('suggested');
    });

    it('score < 15 → none（結果に含まない）', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 10, level: 'low' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations).toHaveLength(0);
    });

    it('カスタム閾値が効く', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 45, level: 'high' }),
      ]);
      const result = buildReviewRecommendations(riskResult, {
        baseDate: BASE_DATE,
        thresholds: { urgent: 40 },
      });
      expect(result.recommendations[0].urgency).toBe('urgent');
    });
  });

  describe('提案セクション特定', () => {
    it('行動変化アラート → §2 対象行動', () => {
      const riskResult = makeRiskResult([
        makeUserScore({
          score: 50,
          level: 'high',
          alerts: [
            { ruleId: 'r1', label: '行動の変化が顕著です', userCode: 'U001', userDisplayName: '田中', severity: 'alert', suggestion: '計画見直し', evidenceHandoffIds: [] },
          ],
        }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      const sections = result.recommendations[0].proposedSections;
      expect(sections.some(s => s.section === '§2')).toBe(true);
    });

    it('危機アラート → §8 危機対応', () => {
      const riskResult = makeRiskResult([
        makeUserScore({
          score: 70,
          level: 'critical',
          alerts: [
            { ruleId: 'r2', label: '拘束の記録が増加しています', userCode: 'U001', userDisplayName: '田中', severity: 'critical', suggestion: '緊急確認', evidenceHandoffIds: [] },
          ],
        }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      const sections = result.recommendations[0].proposedSections;
      expect(sections.some(s => s.section === '§8')).toBe(true);
    });

    it('時間帯パターン → §5 予防的支援', () => {
      const riskResult = makeRiskResult([
        makeUserScore({
          score: 40,
          level: 'high',
          patterns: [
            { type: 'same-timeband-repeat', userCode: 'U001', userDisplayName: '田中', confidence: 'high', summary: '午前中に集中', handoffIds: [], count: 3, firstSeenAt: '', lastSeenAt: '' },
          ],
        }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      const sections = result.recommendations[0].proposedSections;
      expect(sections.some(s => s.section === '§5')).toBe(true);
    });

    it('未対応パターン → §7 問題行動時の対応', () => {
      const riskResult = makeRiskResult([
        makeUserScore({
          score: 35,
          level: 'high',
          patterns: [
            { type: 'unresolved-repeat', userCode: 'U001', userDisplayName: '田中', confidence: 'medium', summary: '未対応案件が繰り返し', handoffIds: [], count: 3, firstSeenAt: '', lastSeenAt: '' },
          ],
        }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      const sections = result.recommendations[0].proposedSections;
      expect(sections.some(s => s.section === '§7')).toBe(true);
    });

    it('連続日パターン → §9 モニタリング', () => {
      const riskResult = makeRiskResult([
        makeUserScore({
          score: 35,
          level: 'high',
          patterns: [
            { type: 'consecutive-days', userCode: 'U001', userDisplayName: '田中', confidence: 'high', summary: '3日連続', handoffIds: [], consecutiveDays: 3, count: 3, firstSeenAt: '', lastSeenAt: '' },
          ],
        }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      const sections = result.recommendations[0].proposedSections;
      expect(sections.some(s => s.section === '§9')).toBe(true);
    });

    it('具体セクション不明でスコア高 → §3 氷山分析', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 35, level: 'high' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      const sections = result.recommendations[0].proposedSections;
      expect(sections.some(s => s.section === '§3')).toBe(true);
    });
  });

  describe('サマリーとソート', () => {
    it('サマリーに利用者名とセクション名が含まれる', () => {
      const riskResult = makeRiskResult([
        makeUserScore({
          score: 50,
          level: 'high',
          alerts: [
            { ruleId: 'r1', label: '行動の変化', userCode: 'U001', userDisplayName: '田中', severity: 'alert', suggestion: '', evidenceHandoffIds: [] },
          ],
        }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations[0].summary).toContain('田中太郎');
      expect(result.recommendations[0].summary).toContain('対象行動');
    });

    it('urgency 降順でソートされる', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ userCode: 'U002', score: 20, level: 'moderate' }),
        makeUserScore({ userCode: 'U001', score: 65, level: 'critical' }),
        makeUserScore({ userCode: 'U003', score: 40, level: 'high' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations[0].urgency).toBe('urgent');
      expect(result.recommendations[1].urgency).toBe('recommended');
      expect(result.recommendations[2].urgency).toBe('suggested');
    });
  });

  describe('byUrgency カウント', () => {
    it('urgency 別のカウントが正しい', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ userCode: 'U001', score: 65, level: 'critical' }),
        makeUserScore({ userCode: 'U002', score: 40, level: 'high' }),
        makeUserScore({ userCode: 'U003', score: 20, level: 'moderate' }),
        makeUserScore({ userCode: 'U004', score: 10, level: 'low' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.byUrgency.urgent).toBe(1);
      expect(result.byUrgency.recommended).toBe(1);
      expect(result.byUrgency.suggested).toBe(1);
      expect(result.reviewTargetCount).toBe(3);
      expect(result.totalUsersEvaluated).toBe(4);
    });
  });

  describe('空入力', () => {
    it('空のリスク結果 → 空の提案', () => {
      const riskResult = makeRiskResult([]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations).toHaveLength(0);
      expect(result.reviewTargetCount).toBe(0);
    });
  });

  describe('generatedAt', () => {
    it('baseDate が generatedAt に反映される', () => {
      const riskResult = makeRiskResult([
        makeUserScore({ score: 65, level: 'critical' }),
      ]);
      const result = buildReviewRecommendations(riskResult, { baseDate: BASE_DATE });
      expect(result.recommendations[0].generatedAt).toBe('2026-03-16T12:00:00.000Z');
    });
  });
});
