/**
 * @fileoverview ISP 計画書ドラフト生成 のテスト
 * @description
 * Phase 5-A:
 *   buildIspPlanDraft の入出力を検証する。
 *   6セクションの構造・順序・内容を網羅的にテスト。
 */

import { describe, it, expect } from 'vitest';
import { buildIspPlanDraft } from './ispPlanDraftUtils';
import type { BuildIspPlanDraftInput } from './ispPlanDraftTypes';
import type { GoalProgressSummary } from './goalProgressTypes';
import type { IspRecommendation } from './ispRecommendationTypes';
import type { IspRecommendationDecision, DecisionSummary, RecommendationSnapshot } from './ispRecommendationDecisionTypes';

// ─── テストヘルパー ──────────────────────────────────────

function makeGoalProgress(overrides?: Partial<GoalProgressSummary>): GoalProgressSummary {
  return {
    goalId: 'goal-1',
    level: 'progressing',
    rate: 0.6,
    trend: 'improving',
    matchedRecordCount: 10,
    matchedTagCount: 5,
    linkedCategories: ['communication'],
    ...overrides,
  };
}

function makeSnapshot(overrides?: Partial<RecommendationSnapshot>): RecommendationSnapshot {
  return {
    level: 'adjust-support',
    reason: 'テスト理由',
    progressLevel: 'stagnant',
    rate: 0.4,
    trend: 'stable',
    matchedRecordCount: 8,
    matchedTagCount: 3,
    ...overrides,
  };
}

function makeDecision(overrides?: Partial<IspRecommendationDecision>): IspRecommendationDecision {
  return {
    id: 'dec-1',
    goalId: 'goal-1',
    userId: 'user-1',
    status: 'accepted',
    decidedBy: 'tester@example.com',
    decidedAt: '2026-03-10T10:00:00Z',
    note: '',
    snapshot: makeSnapshot(),
    monitoringPeriodFrom: '2026-02-01',
    monitoringPeriodTo: '2026-03-01',
    ...overrides,
  };
}

function makeRecommendation(overrides?: Partial<IspRecommendation>): IspRecommendation {
  return {
    goalId: 'goal-1',
    level: 'adjust-support',
    reason: '進捗が停滞。支援方法の見直しを提案。',
    evidence: {
      progressLevel: 'stagnant',
      rate: 0.4,
      trend: 'stable',
      matchedRecordCount: 8,
      matchedTagCount: 3,
      linkedCategories: ['communication'],
    },
    ...overrides,
  };
}

function makeDecisionSummary(overrides?: Partial<DecisionSummary>): DecisionSummary {
  return {
    totalGoals: 4,
    decidedCount: 2,
    pendingCount: 2,
    byStatus: { pending: 2, accepted: 1, dismissed: 0, deferred: 1 },
    lastDecidedAt: '2026-03-10T10:00:00Z',
    lastDecidedBy: 'tester@example.com',
    ...overrides,
  };
}

// ─── テスト ──────────────────────────────────────────────

describe('buildIspPlanDraft', () => {
  // ── 構造 ──

  describe('構造', () => {
    it('空入力でも6セクション返す', () => {
      const draft = buildIspPlanDraft({});
      expect(draft.sections).toHaveLength(6);
    });

    it('6セクションが正しい順序で並ぶ', () => {
      const draft = buildIspPlanDraft({});
      const kinds = draft.sections.map((s) => s.kind);
      expect(kinds).toEqual([
        'overview',
        'monitoring-findings',
        'goal-assessment',
        'decision-summary',
        'plan-revision',
        'next-actions',
      ]);
    });

    it('各セクションに title が設定される', () => {
      const draft = buildIspPlanDraft({});
      for (const section of draft.sections) {
        expect(section.title).toBeTruthy();
      }
    });

    it('各セクションの lines が空配列にならない', () => {
      const draft = buildIspPlanDraft({});
      for (const section of draft.sections) {
        expect(section.lines.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 1. 期間概要 ──

  describe('overview セクション', () => {
    it('期間情報があれば対象期間を表示', () => {
      const draft = buildIspPlanDraft({
        periodSummary: { from: '2026-02-01', to: '2026-03-01' },
      });
      const overview = draft.sections[0];
      expect(overview.lines.some((l) => l.includes('2026-02-01'))).toBe(true);
      expect(overview.lines.some((l) => l.includes('2026-03-01'))).toBe(true);
    });

    it('記録率を表示', () => {
      const draft = buildIspPlanDraft({
        periodSummary: { recordRate: 77, recordedDays: 20, totalDays: 26 },
      });
      const overview = draft.sections[0];
      expect(overview.lines.some((l) => l.includes('77%'))).toBe(true);
      expect(overview.lines.some((l) => l.includes('20日'))).toBe(true);
    });

    it('目標数を表示', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress(), makeGoalProgress({ goalId: 'goal-2' })],
      });
      const overview = draft.sections[0];
      expect(overview.lines.some((l) => l.includes('2件'))).toBe(true);
    });

    it('判断サマリーがあれば判断済み/未判断を表示', () => {
      const draft = buildIspPlanDraft({
        decisionSummary: makeDecisionSummary(),
      });
      const overview = draft.sections[0];
      expect(overview.lines.some((l) => l.includes('判断済み: 2件'))).toBe(true);
      expect(overview.lines.some((l) => l.includes('未判断: 2件'))).toBe(true);
    });

    it('期間情報なしではデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({});
      const overview = draft.sections[0];
      expect(overview.lines[0]).toBe('期間情報がありません。');
    });
  });

  // ── 2. モニタリング所見 ──

  describe('monitoring-findings セクション', () => {
    it('monitoringFindings をそのまま lines に流す', () => {
      const findings = [
        '【活動状況】午前は作業が中心。',
        '【昼食摂取】完食 80%。',
      ];
      const draft = buildIspPlanDraft({ monitoringFindings: findings });
      const section = draft.sections[1];
      expect(section.lines).toEqual(findings);
    });

    it('所見データなしではデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({});
      const section = draft.sections[1];
      expect(section.lines[0]).toBe('モニタリング所見データがありません。');
    });

    it('空配列でもデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({ monitoringFindings: [] });
      const section = draft.sections[1];
      expect(section.lines[0]).toBe('モニタリング所見データがありません。');
    });
  });

  // ── 3. 目標別評価 ──

  describe('goal-assessment セクション', () => {
    it('進捗データなしではデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({});
      const section = draft.sections[2];
      expect(section.lines[0]).toBe('目標進捗データがありません。');
    });

    it('goalNames で目標名を優先表示', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        goalNames: { g1: '短期目標①' },
      });
      const section = draft.sections[2];
      expect(section.lines[0]).toContain('短期目標①');
    });

    it('goalNames がない場合は goalId で表示', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ goalId: 'g-abc' })],
      });
      const section = draft.sections[2];
      expect(section.lines[0]).toContain('目標(g-abc)');
    });

    it('進捗レベルと達成率を含む', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ level: 'achieved', rate: 0.85 })],
        goalNames: { 'goal-1': 'テスト目標' },
      });
      const section = draft.sections[2];
      const text = section.lines[0];
      expect(text).toContain('達成');
      expect(text).toContain('85%');
    });

    it('判断ありの場合はステータスと日付を含む', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        decisions: [makeDecision({ goalId: 'g1', status: 'accepted', decidedAt: '2026-03-10T10:00:00Z' })],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[2];
      const text = section.lines[0];
      expect(text).toContain('採用');
      expect(text).toContain('2026/03/10');
    });

    it('判断なしの場合は「未判断」表示', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        decisions: [],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[2];
      expect(section.lines[0]).toContain('未判断');
    });

    it('メモがある場合はメモを含む', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        decisions: [makeDecision({ goalId: 'g1', note: '記録増加のため' })],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[2];
      expect(section.lines[0]).toContain('記録増加のため');
    });

    it('ISP提案がある場合は提案レベルを含む', () => {
      const rec = makeRecommendation({ goalId: 'g1', level: 'revise-goal' });
      const draft = buildIspPlanDraft({
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        ispRecommendations: {
          recommendations: [rec],
          overallLevel: 'revise-goal',
          actionableCount: 1,
          totalGoalCount: 1,
          summaryText: '',
        },
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[2];
      expect(section.lines[0]).toContain('目標再設定');
    });

    it('複数目標がある場合は各目標分の評価が並ぶ', () => {
      const draft = buildIspPlanDraft({
        goalProgress: [
          makeGoalProgress({ goalId: 'g1' }),
          makeGoalProgress({ goalId: 'g2', level: 'stagnant' }),
        ],
        goalNames: { g1: '短期①', g2: '短期②' },
      });
      const section = draft.sections[2];
      expect(section.lines).toHaveLength(2);
      expect(section.lines[0]).toContain('短期①');
      expect(section.lines[1]).toContain('短期②');
    });
  });

  // ── 4. 判断結果まとめ ──

  describe('decision-summary セクション', () => {
    it('判断データなしではデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({});
      const section = draft.sections[3];
      expect(section.lines[0]).toBe('判断データがありません。');
    });

    it('ステータス別件数を表示', () => {
      const draft = buildIspPlanDraft({
        decisionSummary: makeDecisionSummary({
          byStatus: { pending: 1, accepted: 2, dismissed: 0, deferred: 1 },
        }),
      });
      const section = draft.sections[3];
      expect(section.lines.some((l) => l.includes('採用: 2件'))).toBe(true);
      expect(section.lines.some((l) => l.includes('保留: 1件'))).toBe(true);
      expect(section.lines.some((l) => l.includes('見送り: 0件'))).toBe(true);
      expect(section.lines.some((l) => l.includes('未判断: 1件'))).toBe(true);
    });

    it('最終判断日時を表示', () => {
      const draft = buildIspPlanDraft({
        decisionSummary: makeDecisionSummary({ lastDecidedAt: '2026-03-15T14:00:00Z' }),
      });
      const section = draft.sections[3];
      expect(section.lines.some((l) => l.includes('2026/03/15'))).toBe(true);
    });
  });

  // ── 5. 計画見直し案 ──

  describe('plan-revision セクション', () => {
    it('判断なしではデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({});
      const section = draft.sections[4];
      expect(section.lines[0]).toContain('判断データがありません');
    });

    it('採用された判断は「対応案」に含まれる', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'adjust-support' }) }),
        ],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[4];
      expect(section.lines.some((l) => l.includes('採用された提案'))).toBe(true);
      expect(section.lines.some((l) => l.includes('短期①'))).toBe(true);
      expect(section.lines.some((l) => l.includes('支援方法の見直し'))).toBe(true);
    });

    it('保留された判断は「確認事項」に含まれる', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g2', status: 'deferred', note: '記録数不足' }),
        ],
        goalNames: { g2: '短期②' },
      });
      const section = draft.sections[4];
      expect(section.lines.some((l) => l.includes('保留中の提案'))).toBe(true);
      expect(section.lines.some((l) => l.includes('短期②'))).toBe(true);
      expect(section.lines.some((l) => l.includes('記録数不足'))).toBe(true);
    });

    it('見送りされた判断は「見送り」に含まれる', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g3', status: 'dismissed', note: '環境要因' }),
        ],
        goalNames: { g3: '短期③' },
      });
      const section = draft.sections[4];
      expect(section.lines.some((l) => l.includes('見送りの提案'))).toBe(true);
      expect(section.lines.some((l) => l.includes('計画変更を行わない'))).toBe(true);
      expect(section.lines.some((l) => l.includes('環境要因'))).toBe(true);
    });

    it('continue レベルの提案が採用された場合は「次段階」を含む', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'continue' }) }),
        ],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[4];
      expect(section.lines.some((l) => l.includes('次段階'))).toBe(true);
    });

    it('urgent-review レベルの提案が採用された場合は「緊急」を含む', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'urgent-review' }) }),
        ],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[4];
      expect(section.lines.some((l) => l.includes('緊急'))).toBe(true);
    });
  });

  // ── 6. 次期アクション ──

  describe('next-actions セクション', () => {
    it('データなしではデフォルトメッセージ', () => {
      const draft = buildIspPlanDraft({});
      const section = draft.sections[5];
      expect(section.lines[0]).toBe('次期アクションはありません。');
    });

    it('採用された判断に対する TODO が生成される', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'adjust-support' }) }),
        ],
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[5];
      expect(section.lines.some((l) => l.includes('短期①'))).toBe(true);
      expect(section.lines.some((l) => l.includes('検討'))).toBe(true);
    });

    it('保留された判断に対する再評価 TODO が生成される', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g2', status: 'deferred' }),
        ],
        goalProgress: [makeGoalProgress({ goalId: 'g2' })],
        goalNames: { g2: '短期②' },
      });
      const section = draft.sections[5];
      expect(section.lines.some((l) => l.includes('短期②'))).toBe(true);
      expect(section.lines.some((l) => l.includes('再評価'))).toBe(true);
    });

    it('未判断目標に対する判断確定 TODO が生成される', () => {
      const draft = buildIspPlanDraft({
        decisions: [],
        goalProgress: [makeGoalProgress({ goalId: 'g3' })],
        goalNames: { g3: '支援目標①' },
      });
      const section = draft.sections[5];
      expect(section.lines.some((l) => l.includes('支援目標①'))).toBe(true);
      expect(section.lines.some((l) => l.includes('判断を確定'))).toBe(true);
    });

    it('アクションに番号が振られる', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'revise-goal' }) }),
          makeDecision({ goalId: 'g2', status: 'deferred' }),
        ],
        goalProgress: [
          makeGoalProgress({ goalId: 'g1' }),
          makeGoalProgress({ goalId: 'g2' }),
          makeGoalProgress({ goalId: 'g3' }),
        ],
        goalNames: { g1: '短期①', g2: '短期②', g3: '支援目標①' },
      });
      const section = draft.sections[5];
      expect(section.lines[0]).toMatch(/^1\./);
      expect(section.lines[1]).toMatch(/^2\./);
      expect(section.lines[2]).toMatch(/^3\./);
    });

    it('revise-goal の採用は「次期目標文を作成」を含む', () => {
      const draft = buildIspPlanDraft({
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'revise-goal' }) }),
        ],
        goalProgress: [makeGoalProgress({ goalId: 'g1' })],
        goalNames: { g1: '短期①' },
      });
      const section = draft.sections[5];
      expect(section.lines.some((l) => l.includes('次期目標文'))).toBe(true);
    });
  });

  // ── 統合テスト ──

  describe('統合テスト（フル入力）', () => {
    it('全入力を与えた場合に6セクション全てに内容がある', () => {
      const input: BuildIspPlanDraftInput = {
        periodSummary: {
          from: '2026-02-01',
          to: '2026-03-01',
          recordedDays: 20,
          totalDays: 28,
          recordRate: 71,
        },
        monitoringFindings: [
          '【活動状況】午前は作業中心。午後はレクリエーション。',
          '【昼食摂取】完食60%。摂取状況は概ね安定。',
        ],
        goalProgress: [
          makeGoalProgress({ goalId: 'g1', level: 'achieved', rate: 0.85, trend: 'improving' }),
          makeGoalProgress({ goalId: 'g2', level: 'stagnant', rate: 0.35, trend: 'declining' }),
          makeGoalProgress({ goalId: 'g3', level: 'progressing', rate: 0.55, trend: 'stable' }),
          makeGoalProgress({ goalId: 'g4', level: 'noData', rate: 0, trend: 'stable' }),
        ],
        ispRecommendations: {
          recommendations: [
            makeRecommendation({ goalId: 'g1', level: 'continue' }),
            makeRecommendation({ goalId: 'g2', level: 'revise-goal' }),
            makeRecommendation({ goalId: 'g3', level: 'continue' }),
            makeRecommendation({ goalId: 'g4', level: 'pending' }),
          ],
          overallLevel: 'revise-goal',
          actionableCount: 3,
          totalGoalCount: 4,
          summaryText: '4目標中: 継続2件、目標再設定1件、判定保留1件。',
        },
        decisions: [
          makeDecision({ goalId: 'g1', status: 'accepted', snapshot: makeSnapshot({ level: 'continue' }), note: '次段階検討' }),
          makeDecision({ goalId: 'g2', status: 'accepted', snapshot: makeSnapshot({ level: 'revise-goal' }), note: '目標変更' }),
          makeDecision({ goalId: 'g3', status: 'deferred', snapshot: makeSnapshot({ level: 'continue' }), note: '記録不足' }),
        ],
        decisionSummary: makeDecisionSummary({
          totalGoals: 4,
          decidedCount: 3,
          pendingCount: 1,
          byStatus: { pending: 1, accepted: 2, dismissed: 0, deferred: 1 },
        }),
        goalNames: {
          g1: '長期目標①「基本的なあいさつ」',
          g2: '短期目標①「声かけへの応答」',
          g3: '短期目標②「自発的な挨拶」',
          g4: '支援目標①「日常動作の安定」',
        },
      };

      const draft = buildIspPlanDraft(input);

      // 6セクション
      expect(draft.sections).toHaveLength(6);

      // overview にデータが反映されている
      const overview = draft.sections[0];
      expect(overview.lines.some((l) => l.includes('71%'))).toBe(true);
      expect(overview.lines.some((l) => l.includes('4件'))).toBe(true);

      // monitoring-findings にそのまま入っている
      const findings = draft.sections[1];
      expect(findings.lines).toHaveLength(2);

      // goal-assessment に4目標分
      const assessment = draft.sections[2];
      expect(assessment.lines).toHaveLength(4);
      expect(assessment.lines[0]).toContain('長期目標①');
      expect(assessment.lines[1]).toContain('短期目標①');

      // decision-summary にステータス別
      const summary = draft.sections[3];
      expect(summary.lines.some((l) => l.includes('採用: 2件'))).toBe(true);

      // plan-revision に採用と保留が含まれる
      const revision = draft.sections[4];
      expect(revision.lines.some((l) => l.includes('採用された提案'))).toBe(true);
      expect(revision.lines.some((l) => l.includes('保留中の提案'))).toBe(true);

      // next-actions に番号付き TODO
      const actions = draft.sections[5];
      expect(actions.lines[0]).toMatch(/^1\./);
      expect(actions.lines.some((l) => l.includes('支援目標①'))).toBe(true);
      expect(actions.lines.some((l) => l.includes('判断を確定'))).toBe(true);
    });
  });
});
