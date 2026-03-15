// ---------------------------------------------------------------------------
// evidencePatternAnalysis.spec.ts — Evidence Pattern Analysis のユニットテスト
//
// 戦略別採用件数 / 頻出根拠ランキング / 場面・行動・強度の傾向分析 /
// 有効支援パターン / 統合サマリーの各関数をテストする。
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  getEvidenceLinkCountsByStrategy,
  getTopLinkedAbcRecords,
  getTopLinkedPdcaItems,
  getTopSettings,
  getTopBehaviors,
  getIntensityDistribution,
  getStrategyIntensityProfiles,
  getSettingBehaviorPatterns,
  buildEvidencePatternSummary,
} from '@/domain/isp/evidencePatternAnalysis';
import type { EvidenceLinkMap, EvidenceLink } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeLink(overrides: Partial<EvidenceLink> = {}): EvidenceLink {
  return {
    type: 'abc',
    referenceId: 'ref_1',
    label: '[ABC] テスト行動',
    linkedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

function makeAbcRecord(overrides: Partial<AbcRecord> = {}): AbcRecord {
  return {
    id: 'abc_1',
    userId: 'user_1',
    userName: 'テスト太郎',
    occurredAt: '2026-03-15T09:00:00Z',
    setting: '活動場面',
    antecedent: '指示があった',
    behavior: '大声で叫ぶ',
    consequence: '注目を受けた',
    intensity: 'medium',
    durationMinutes: 5,
    riskFlag: false,
    recorderName: '記録者A',
    tags: [],
    notes: '',
    createdAt: '2026-03-15T09:30:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. getEvidenceLinkCountsByStrategy
// ---------------------------------------------------------------------------

describe('getEvidenceLinkCountsByStrategy', () => {
  it('returns zeros for empty map', () => {
    const result = getEvidenceLinkCountsByStrategy(createEmptyEvidenceLinkMap());

    expect(result.antecedentStrategies).toEqual({ abc: 0, pdca: 0, total: 0 });
    expect(result.teachingStrategies).toEqual({ abc: 0, pdca: 0, total: 0 });
    expect(result.consequenceStrategies).toEqual({ abc: 0, pdca: 0, total: 0 });
    expect(result.grandTotal).toEqual({ abc: 0, pdca: 0, total: 0 });
  });

  it('counts correctly by type and strategy', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'a1' }),
        makeLink({ type: 'abc', referenceId: 'a2' }),
        makeLink({ type: 'pdca', referenceId: 'p1' }),
      ],
      teachingStrategies: [
        makeLink({ type: 'pdca', referenceId: 'p2' }),
        makeLink({ type: 'pdca', referenceId: 'p3' }),
      ],
      consequenceStrategies: [
        makeLink({ type: 'abc', referenceId: 'a3' }),
      ],
    };

    const result = getEvidenceLinkCountsByStrategy(map);

    expect(result.antecedentStrategies).toEqual({ abc: 2, pdca: 1, total: 3 });
    expect(result.teachingStrategies).toEqual({ abc: 0, pdca: 2, total: 2 });
    expect(result.consequenceStrategies).toEqual({ abc: 1, pdca: 0, total: 1 });
    expect(result.grandTotal).toEqual({ abc: 3, pdca: 3, total: 6 });
  });
});

// ---------------------------------------------------------------------------
// 2. getTopLinkedAbcRecords / getTopLinkedPdcaItems
// ---------------------------------------------------------------------------

describe('getTopLinkedAbcRecords', () => {
  it('returns empty for empty map', () => {
    expect(getTopLinkedAbcRecords(createEmptyEvidenceLinkMap())).toEqual([]);
  });

  it('ranks by frequency across all strategies', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'abc_1', label: 'ABC-1' }),
        makeLink({ type: 'abc', referenceId: 'abc_2', label: 'ABC-2' }),
      ],
      teachingStrategies: [
        makeLink({ type: 'abc', referenceId: 'abc_1', label: 'ABC-1' }),  // abc_1 appears twice
      ],
      consequenceStrategies: [
        makeLink({ type: 'abc', referenceId: 'abc_3', label: 'ABC-3' }),
        makeLink({ type: 'abc', referenceId: 'abc_1', label: 'ABC-1' }),  // abc_1 appears three times total
      ],
    };

    const result = getTopLinkedAbcRecords(map);

    expect(result[0].id).toBe('abc_1');
    expect(result[0].count).toBe(3);
    expect(result).toHaveLength(3);
  });

  it('respects topN parameter', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'a1', label: 'A1' }),
        makeLink({ type: 'abc', referenceId: 'a2', label: 'A2' }),
        makeLink({ type: 'abc', referenceId: 'a3', label: 'A3' }),
      ],
      teachingStrategies: [],
      consequenceStrategies: [],
    };

    expect(getTopLinkedAbcRecords(map, 2)).toHaveLength(2);
  });

  it('ignores PDCA links', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'pdca', referenceId: 'p1', label: 'PDCA-1' }),
      ],
      teachingStrategies: [],
      consequenceStrategies: [],
    };

    expect(getTopLinkedAbcRecords(map)).toEqual([]);
  });
});

describe('getTopLinkedPdcaItems', () => {
  it('returns only PDCA links', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'a1' }),
        makeLink({ type: 'pdca', referenceId: 'p1', label: 'PDCA-1' }),
      ],
      teachingStrategies: [
        makeLink({ type: 'pdca', referenceId: 'p1', label: 'PDCA-1' }),
      ],
      consequenceStrategies: [],
    };

    const result = getTopLinkedPdcaItems(map);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. getTopSettings / getTopBehaviors
// ---------------------------------------------------------------------------

describe('getTopSettings', () => {
  it('returns empty for empty records', () => {
    expect(getTopSettings([])).toEqual([]);
  });

  it('ranks settings by frequency', () => {
    const records = [
      makeAbcRecord({ setting: '活動場面' }),
      makeAbcRecord({ setting: '活動場面' }),
      makeAbcRecord({ setting: '食事場面' }),
      makeAbcRecord({ setting: '活動場面' }),
      makeAbcRecord({ setting: '食事場面' }),
      makeAbcRecord({ setting: '朝の会' }),
    ];

    const result = getTopSettings(records);

    expect(result[0].label).toBe('活動場面');
    expect(result[0].count).toBe(3);
    expect(result[1].label).toBe('食事場面');
    expect(result[1].count).toBe(2);
    expect(result[2].label).toBe('朝の会');
    expect(result[2].count).toBe(1);
  });

  it('excludes empty settings', () => {
    const records = [
      makeAbcRecord({ setting: '' }),
      makeAbcRecord({ setting: '活動場面' }),
    ];

    const result = getTopSettings(records);
    expect(result).toHaveLength(1);
  });
});

describe('getTopBehaviors', () => {
  it('ranks behaviors by frequency', () => {
    const records = [
      makeAbcRecord({ behavior: '大声で叫ぶ' }),
      makeAbcRecord({ behavior: '大声で叫ぶ' }),
      makeAbcRecord({ behavior: '離席する' }),
    ];

    const result = getTopBehaviors(records);

    expect(result[0].label).toBe('大声で叫ぶ');
    expect(result[0].count).toBe(2);
  });

  it('truncates long behaviors', () => {
    const longBehavior = 'これはとても長い行動記述でありテスト用に20文字以上ある';
    const records = [makeAbcRecord({ behavior: longBehavior })];

    const result = getTopBehaviors(records);

    expect(result[0].label.length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 4. getIntensityDistribution
// ---------------------------------------------------------------------------

describe('getIntensityDistribution', () => {
  it('returns zeros for empty records', () => {
    const result = getIntensityDistribution([]);

    expect(result).toEqual({
      low: 0, medium: 0, high: 0, total: 0, riskCount: 0, riskRate: 0,
    });
  });

  it('counts intensity levels correctly', () => {
    const records = [
      makeAbcRecord({ intensity: 'low' }),
      makeAbcRecord({ intensity: 'low' }),
      makeAbcRecord({ intensity: 'medium' }),
      makeAbcRecord({ intensity: 'high', riskFlag: true }),
      makeAbcRecord({ intensity: 'high', riskFlag: true }),
    ];

    const result = getIntensityDistribution(records);

    expect(result.low).toBe(2);
    expect(result.medium).toBe(1);
    expect(result.high).toBe(2);
    expect(result.total).toBe(5);
    expect(result.riskCount).toBe(2);
    expect(result.riskRate).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// 5. getStrategyIntensityProfiles
// ---------------------------------------------------------------------------

describe('getStrategyIntensityProfiles', () => {
  it('returns profiles for all three strategies', () => {
    const map = createEmptyEvidenceLinkMap();
    const lookup = new Map<string, AbcRecord>();

    const result = getStrategyIntensityProfiles(map, lookup);

    expect(result).toHaveLength(3);
    expect(result.map(p => p.strategy)).toEqual([
      'antecedentStrategies',
      'teachingStrategies',
      'consequenceStrategies',
    ]);
  });

  it('resolves intensity from linked ABC records', () => {
    const abc1 = makeAbcRecord({ id: 'abc_1', intensity: 'high', riskFlag: true });
    const abc2 = makeAbcRecord({ id: 'abc_2', intensity: 'low' });

    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'abc_1' }),
        makeLink({ type: 'abc', referenceId: 'abc_2' }),
      ],
      teachingStrategies: [],
      consequenceStrategies: [],
    };

    const lookup = new Map([
      ['abc_1', abc1],
      ['abc_2', abc2],
    ]);

    const result = getStrategyIntensityProfiles(map, lookup);

    const antProfile = result[0];
    expect(antProfile.distribution.high).toBe(1);
    expect(antProfile.distribution.low).toBe(1);
    expect(antProfile.distribution.total).toBe(2);
    expect(antProfile.distribution.riskCount).toBe(1);
    expect(antProfile.distribution.riskRate).toBe(0.5);
  });

  it('skips links whose records do not exist in lookup', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'missing_abc' }),
      ],
      teachingStrategies: [],
      consequenceStrategies: [],
    };

    const result = getStrategyIntensityProfiles(map, new Map());

    expect(result[0].distribution.total).toBe(0);
  });

  it('ignores PDCA links in intensity calculation', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'pdca', referenceId: 'p1' }),
      ],
      teachingStrategies: [],
      consequenceStrategies: [],
    };

    const result = getStrategyIntensityProfiles(map, new Map());

    expect(result[0].distribution.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. getSettingBehaviorPatterns
// ---------------------------------------------------------------------------

describe('getSettingBehaviorPatterns', () => {
  it('returns empty for empty data', () => {
    expect(getSettingBehaviorPatterns(createEmptyEvidenceLinkMap(), new Map())).toEqual([]);
  });

  it('identifies setting × behavior patterns with dominant strategy', () => {
    const abc1 = makeAbcRecord({ id: 'abc_1', setting: '活動場面', behavior: '大声で叫ぶ' });
    const abc2 = makeAbcRecord({ id: 'abc_2', setting: '活動場面', behavior: '大声で叫ぶ' });
    const abc3 = makeAbcRecord({ id: 'abc_3', setting: '食事場面', behavior: '離席する' });

    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'abc_1' }),
        makeLink({ type: 'abc', referenceId: 'abc_2' }),
      ],
      teachingStrategies: [
        makeLink({ type: 'abc', referenceId: 'abc_1' }),
        makeLink({ type: 'abc', referenceId: 'abc_3' }),
      ],
      consequenceStrategies: [],
    };

    const lookup = new Map([
      ['abc_1', abc1],
      ['abc_2', abc2],
      ['abc_3', abc3],
    ]);

    const result = getSettingBehaviorPatterns(map, lookup);

    // "活動場面 × 大声で叫ぶ" should be rank 1 (abc_1 + abc_2 = 2 occurrences)
    expect(result[0].setting).toBe('活動場面');
    expect(result[0].behavior).toBe('大声で叫ぶ');
    expect(result[0].count).toBe(2);
    // abc_1 is in both ant + teaching, abc_2 is in ant only → ant:2, teaching:1
    expect(result[0].dominantStrategy).toBe('antecedentStrategies');
  });

  it('excludes records without setting', () => {
    const abc = makeAbcRecord({ id: 'abc_1', setting: '', behavior: '大声' });
    const map: EvidenceLinkMap = {
      antecedentStrategies: [makeLink({ type: 'abc', referenceId: 'abc_1' })],
      teachingStrategies: [],
      consequenceStrategies: [],
    };

    const result = getSettingBehaviorPatterns(map, new Map([['abc_1', abc]]));
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. buildEvidencePatternSummary
// ---------------------------------------------------------------------------

describe('buildEvidencePatternSummary', () => {
  it('generates a complete summary from empty data', () => {
    const result = buildEvidencePatternSummary(createEmptyEvidenceLinkMap(), []);

    expect(result.totalAbcRecords).toBe(0);
    expect(result.totalLinks).toBe(0);
    expect(result.strategyLinkCounts.grandTotal.total).toBe(0);
    expect(result.topLinkedAbcRecords).toEqual([]);
    expect(result.topLinkedPdcaItems).toEqual([]);
    expect(result.topSettings).toEqual([]);
    expect(result.topBehaviors).toEqual([]);
    expect(result.overallIntensity.total).toBe(0);
    expect(result.strategyIntensityProfiles).toHaveLength(3);
    expect(result.settingBehaviorPatterns).toEqual([]);
  });

  it('generates a rich summary with populated data', () => {
    const records = [
      makeAbcRecord({ id: 'a1', setting: '活動', behavior: '大声', intensity: 'high', riskFlag: true }),
      makeAbcRecord({ id: 'a2', setting: '活動', behavior: '大声', intensity: 'medium' }),
      makeAbcRecord({ id: 'a3', setting: '食事', behavior: '離席', intensity: 'low' }),
    ];

    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        makeLink({ type: 'abc', referenceId: 'a1', label: 'ABC-A1' }),
        makeLink({ type: 'pdca', referenceId: 'p1', label: 'PDCA-P1' }),
      ],
      teachingStrategies: [
        makeLink({ type: 'abc', referenceId: 'a1', label: 'ABC-A1' }),
      ],
      consequenceStrategies: [
        makeLink({ type: 'abc', referenceId: 'a3', label: 'ABC-A3' }),
      ],
    };

    const result = buildEvidencePatternSummary(map, records);

    expect(result.totalAbcRecords).toBe(3);
    expect(result.totalLinks).toBe(4);

    // Strategy counts
    expect(result.strategyLinkCounts.grandTotal).toEqual({ abc: 3, pdca: 1, total: 4 });

    // Top ABC: a1 appears in 2 strategies
    expect(result.topLinkedAbcRecords[0].id).toBe('a1');
    expect(result.topLinkedAbcRecords[0].count).toBe(2);

    // Top PDCA
    expect(result.topLinkedPdcaItems).toHaveLength(1);
    expect(result.topLinkedPdcaItems[0].id).toBe('p1');

    // Top settings
    expect(result.topSettings[0].label).toBe('活動');

    // Intensity
    expect(result.overallIntensity.high).toBe(1);
    expect(result.overallIntensity.riskCount).toBe(1);

    // Strategy intensity profiles
    const antProfile = result.strategyIntensityProfiles.find(
      p => p.strategy === 'antecedentStrategies',
    );
    expect(antProfile?.distribution.high).toBe(1);

    // Setting × Behavior patterns
    expect(result.settingBehaviorPatterns.length).toBeGreaterThan(0);
  });

  it('respects topN parameter', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeAbcRecord({ id: `a${i}`, setting: `場面${i}`, behavior: `行動${i}` }),
    );

    const result = buildEvidencePatternSummary(createEmptyEvidenceLinkMap(), records, 3);

    expect(result.topSettings).toHaveLength(3);
    expect(result.topBehaviors).toHaveLength(3);
  });
});
