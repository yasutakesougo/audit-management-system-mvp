/**
 * buildReviewProposal.spec.ts — 見直し提案→計画アクション変換のユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { buildReviewProposal, buildReviewProposals } from '../buildReviewProposal';
import type { ReviewRecommendation } from '../reviewRecommendation';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeRecommendation(overrides?: Partial<ReviewRecommendation>): ReviewRecommendation {
  return {
    userCode: 'U001',
    userDisplayName: '田中太郎',
    urgency: 'recommended',
    riskScore: 45,
    riskLevel: 'high',
    proposedSections: [],
    summary: '田中太郎さんの支援計画の見直しを推奨します',
    topSuggestion: '計画の見直しを推奨',
    generatedAt: '2026-03-16T12:00:00.000Z',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('buildReviewProposal', () => {
  describe('セクション → フィールド展開', () => {
    it('§2（対象行動）→ targetBehavior, behaviorFrequency, behaviorSituation', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§2',
          sectionName: '対象行動',
          reason: '行動変化が検出されました',
          evidence: ['行動の変化が顕著です'],
        }],
      });

      const proposal = buildReviewProposal(rec);

      expect(proposal.actions).toHaveLength(3);
      expect(proposal.actions.map(a => a.fieldKey)).toEqual([
        'targetBehavior', 'behaviorFrequency', 'behaviorSituation',
      ]);
      expect(proposal.actions[0].section).toContain('§2');
      expect(proposal.actions[0].actionType).toBe('review');
    });

    it('§3（氷山分析）→ triggers, environmentFactors, emotions, needs', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§3',
          sectionName: '氷山分析',
          reason: 'リスクスコアが高い',
          evidence: [],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions).toHaveLength(4);
      expect(proposal.actions.map(a => a.fieldKey)).toContain('triggers');
      expect(proposal.actions.map(a => a.fieldKey)).toContain('needs');
    });

    it('§5（予防的支援）→ environmentalAdjustment 等', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§5',
          sectionName: '予防的支援',
          reason: '環境要因の変化',
          evidence: ['午前中に集中'],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions).toHaveLength(4);
      expect(proposal.actions.map(a => a.fieldKey)).toContain('environmentalAdjustment');
    });

    it('§7（問題行動時対応）→ initialResponse, staffResponse', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§7',
          sectionName: '問題行動時の対応',
          reason: '未対応案件の繰り返し',
          evidence: ['未対応3回'],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions).toHaveLength(2);
      expect(proposal.actions.map(a => a.fieldKey)).toContain('initialResponse');
    });

    it('§8（危機対応）→ dangerousBehavior, emergencyResponse, medicalCoordination', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§8',
          sectionName: '危機対応',
          reason: '危機レベルのアラート',
          evidence: ['拘束記録の増加'],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions).toHaveLength(3);
      expect(proposal.actions.map(a => a.fieldKey)).toContain('emergencyResponse');
    });

    it('§9（モニタリング）→ evaluationIndicator, evaluationMethod', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§9',
          sectionName: 'モニタリング',
          reason: '連続日パターン',
          evidence: ['3日連続'],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions).toHaveLength(2);
      expect(proposal.actions.map(a => a.fieldKey)).toContain('evaluationIndicator');
    });
  });

  describe('複数セクション', () => {
    it('複数セクションのアクションが結合される', () => {
      const rec = makeRecommendation({
        proposedSections: [
          { section: '§2', sectionName: '対象行動', reason: '行動変化', evidence: [] },
          { section: '§5', sectionName: '予防的支援', reason: '環境変化', evidence: [] },
        ],
      });

      const proposal = buildReviewProposal(rec);
      // §2: 3 + §5: 4 = 7
      expect(proposal.actions).toHaveLength(7);
    });

    it('§8 が2回出た場合はフィールドの重複が除去される', () => {
      const rec = makeRecommendation({
        proposedSections: [
          { section: '§8', sectionName: '危機対応', reason: '拘束', evidence: [] },
          { section: '§8', sectionName: '危機対応（医療連携）', reason: '体調', evidence: [] },
        ],
      });

      const proposal = buildReviewProposal(rec);
      // 重複除去: dangerousBehavior, emergencyResponse, medicalCoordination = 3
      expect(proposal.actions).toHaveLength(3);
    });
  });

  describe('メタ情報', () => {
    it('userCode, urgency, riskScore が維持される', () => {
      const rec = makeRecommendation({
        userCode: 'U099',
        urgency: 'urgent',
        riskScore: 75,
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.userCode).toBe('U099');
      expect(proposal.urgency).toBe('urgent');
      expect(proposal.riskScore).toBe(75);
    });

    it('sourceEvidence にアラート・パターン情報が含まれる', () => {
      const rec = makeRecommendation({
        proposedSections: [
          { section: '§2', sectionName: '対象行動', reason: '行動変化', evidence: ['アラート1', 'アラート2'] },
        ],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.sourceEvidence.alertLabels).toEqual(['アラート1', 'アラート2']);
      expect(proposal.sourceEvidence.patternSummaries).toEqual(['行動変化']);
    });

    it('generatedAt が維持される', () => {
      const rec = makeRecommendation({ generatedAt: '2026-04-01T00:00:00.000Z' });
      const proposal = buildReviewProposal(rec);
      expect(proposal.generatedAt).toBe('2026-04-01T00:00:00.000Z');
    });
  });

  describe('空入力', () => {
    it('proposedSections が空 → actions も空', () => {
      const rec = makeRecommendation({ proposedSections: [] });
      const proposal = buildReviewProposal(rec);
      expect(proposal.actions).toHaveLength(0);
    });
  });

  describe('evidenceSummary', () => {
    it('evidence がある場合は結合される', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§2',
          sectionName: '対象行動',
          reason: '行動変化',
          evidence: ['アラートA', 'アラートB'],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions[0].evidenceSummary).toBe('アラートA / アラートB');
    });

    it('evidence が空の場合は reason がフォールバック', () => {
      const rec = makeRecommendation({
        proposedSections: [{
          section: '§2',
          sectionName: '対象行動',
          reason: '行動変化のため',
          evidence: [],
        }],
      });

      const proposal = buildReviewProposal(rec);
      expect(proposal.actions[0].evidenceSummary).toBe('行動変化のため');
    });
  });
});

describe('buildReviewProposals', () => {
  it('複数の recommendation を一括変換できる', () => {
    const recs = [
      makeRecommendation({ userCode: 'U001', proposedSections: [{ section: '§2', sectionName: '対象行動', reason: '', evidence: [] }] }),
      makeRecommendation({ userCode: 'U002', proposedSections: [{ section: '§5', sectionName: '予防的支援', reason: '', evidence: [] }] }),
    ];

    const proposals = buildReviewProposals(recs);
    expect(proposals).toHaveLength(2);
    expect(proposals[0].userCode).toBe('U001');
    expect(proposals[1].userCode).toBe('U002');
  });
});
