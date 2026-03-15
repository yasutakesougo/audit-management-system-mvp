// ---------------------------------------------------------------------------
// evidenceLink.spec.ts — EvidenceLink ドメイン型のユニットテスト
//
// createEmptyEvidenceLinkMap の構造をテストする。
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  createEmptyEvidenceLinkMap,
  type EvidenceLinkMap,
  type EvidenceLink,
  type StrategyEvidenceKey,
} from '@/domain/isp/evidenceLink';

describe('createEmptyEvidenceLinkMap', () => {
  it('returns a map with all three strategy keys', () => {
    const map = createEmptyEvidenceLinkMap();

    const expectedKeys: StrategyEvidenceKey[] = [
      'antecedentStrategies',
      'teachingStrategies',
      'consequenceStrategies',
    ];

    for (const key of expectedKeys) {
      expect(map).toHaveProperty(key);
    }
    expect(Object.keys(map)).toHaveLength(3);
  });

  it('initializes all arrays as empty', () => {
    const map = createEmptyEvidenceLinkMap();

    expect(map.antecedentStrategies).toEqual([]);
    expect(map.teachingStrategies).toEqual([]);
    expect(map.consequenceStrategies).toEqual([]);
  });

  it('returns a new object each time (not shared reference)', () => {
    const map1 = createEmptyEvidenceLinkMap();
    const map2 = createEmptyEvidenceLinkMap();

    expect(map1).not.toBe(map2);
    expect(map1.antecedentStrategies).not.toBe(map2.antecedentStrategies);
  });

  it('allows mutation without affecting other instances', () => {
    const map1 = createEmptyEvidenceLinkMap();
    const map2 = createEmptyEvidenceLinkMap();

    const link: EvidenceLink = {
      type: 'abc',
      referenceId: 'abc_1',
      label: '[ABC] テスト',
      linkedAt: '2026-03-15T10:00:00Z',
    };

    map1.antecedentStrategies.push(link);

    expect(map1.antecedentStrategies).toHaveLength(1);
    expect(map2.antecedentStrategies).toHaveLength(0);
  });
});

describe('EvidenceLinkMap type compatibility', () => {
  it('accepts valid EvidenceLinkMap structure', () => {
    const map: EvidenceLinkMap = {
      antecedentStrategies: [
        { type: 'abc', referenceId: 'abc_1', label: '[ABC] 行動A', linkedAt: '2026-01-01T00:00:00Z' },
        { type: 'pdca', referenceId: 'pdca_1', label: '[PDCA] 分析A', linkedAt: '2026-01-02T00:00:00Z' },
      ],
      teachingStrategies: [
        { type: 'pdca', referenceId: 'pdca_2', label: '[PDCA] 代替行動', linkedAt: '2026-01-03T00:00:00Z' },
      ],
      consequenceStrategies: [],
    };

    // All links flatten correctly
    const allLinks = [
      ...map.antecedentStrategies,
      ...map.teachingStrategies,
      ...map.consequenceStrategies,
    ];
    expect(allLinks).toHaveLength(3);
    expect(allLinks.filter(l => l.type === 'abc')).toHaveLength(1);
    expect(allLinks.filter(l => l.type === 'pdca')).toHaveLength(2);
  });
});
