// ---------------------------------------------------------------------------
// summarizeEvidence — Unit Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { summarizeEvidence } from '../summarizeEvidence';
import type { SuggestionEvidence } from '../types';

describe('summarizeEvidence', () => {
  it('行動増加傾向のメトリクスを要約', () => {
    const evidence: SuggestionEvidence = {
      metric: '行動発生件数（日平均）',
      currentValue: '5.0',
      threshold: '前週比 +30%',
      period: '直近7日 vs 前7日',
      metrics: {
        recentAvg: 5.0,
        previousAvg: 2.0,
        changeRate: 2.5,
        pctIncrease: 150,
      },
    };

    expect(summarizeEvidence(evidence)).toBe(
      '前週比 +150%（日平均 2 → 5）',
    );
  });

  it('手順実施率のメトリクスを要約', () => {
    const evidence: SuggestionEvidence = {
      metric: '手順実施率',
      currentValue: '52%',
      threshold: '60%',
      period: '分析対象期間',
      metrics: {
        completed: 26,
        triggered: 20,
        skipped: 4,
        total: 50,
        completionRate: 52,
      },
    };

    expect(summarizeEvidence(evidence)).toBe('実施率 52%（26/50件完了）');
  });

  it('高強度行動のメトリクスを要約', () => {
    const evidence: SuggestionEvidence = {
      metric: '高強度行動回数（強度4+）',
      currentValue: 4,
      threshold: 3,
      period: '直近7日間',
      metrics: {
        count: 4,
        threshold: 3,
      },
      sourceRefs: ['abc-1', 'abc-2', 'abc-3', 'abc-4'],
    };

    expect(summarizeEvidence(evidence)).toBe(
      '高強度行動 7日で4回（閾値 3回）',
    );
  });

  it('時間帯集中のメトリクスを要約', () => {
    const evidence: SuggestionEvidence = {
      metric: '時間帯集中率',
      currentValue: '75%（14時台）',
      threshold: '40%',
      period: '分析対象期間',
      metrics: {
        peakHour: 14,
        peakCount: 15,
        totalEvents: 20,
        concentration: 0.75,
      },
    };

    expect(summarizeEvidence(evidence)).toBe('14時台に全体の75%が集中');
  });

  it('BIP未作成のメトリクスを要約', () => {
    const evidence: SuggestionEvidence = {
      metric: '行動記録件数',
      currentValue: 10,
      threshold: '5件（BIP 0件時）',
      period: '分析対象期間',
      metrics: {
        totalIncidents: 10,
        activeBipCount: 0,
      },
    };

    expect(summarizeEvidence(evidence)).toBe('行動 10件に対し BIP 0件');
  });

  it('データ不足のメトリクスを要約', () => {
    const evidence: SuggestionEvidence = {
      metric: '行動記録件数',
      currentValue: 1,
      threshold: '3件（14日間）',
      period: '直近14日間',
      metrics: {
        totalIncidents: 1,
        daysSinceLastRecord: 10,
        lastDateLabel: '3/10',
      },
    };

    expect(summarizeEvidence(evidence)).toBe('直近14日間: 1件のみ（10日未記録）');
  });

  it('metrics がない場合のフォールバック', () => {
    const evidence: SuggestionEvidence = {
      metric: 'カスタム指標',
      currentValue: 42,
      threshold: 30,
      period: '30日間',
    };

    expect(summarizeEvidence(evidence)).toBe('カスタム指標: 42（閾値: 30）');
  });
});
