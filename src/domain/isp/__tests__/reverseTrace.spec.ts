import { describe, expect, it } from 'vitest';

import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';
import {
  getStrategyUsagesForAbcRecord,
  getStrategyUsagesForPdcaItem,
  STRATEGY_LABELS,
} from '@/domain/isp/reverseTrace';

// ── Helpers ──

function makeLinkMap(overrides: Partial<EvidenceLinkMap> = {}): EvidenceLinkMap {
  return { ...createEmptyEvidenceLinkMap(), ...overrides };
}

function abcLink(refId: string) {
  return { type: 'abc' as const, referenceId: refId, label: `ABC-${refId}`, linkedAt: '2026-03-15T10:00:00' };
}

function pdcaLink(refId: string) {
  return { type: 'pdca' as const, referenceId: refId, label: `PDCA-${refId}`, linkedAt: '2026-03-15T10:00:00' };
}

// ── getStrategyUsagesForAbcRecord ──

describe('getStrategyUsagesForAbcRecord', () => {
  it('returns empty summary when no evidence link maps exist', () => {
    const result = getStrategyUsagesForAbcRecord('abc-1', {});
    expect(result.totalUsageCount).toBe(0);
    expect(result.relatedSheetCount).toBe(0);
    expect(result.usages).toEqual([]);
    expect(result.byStrategy.antecedentStrategies).toBe(0);
    expect(result.byStrategy.teachingStrategies).toBe(0);
    expect(result.byStrategy.consequenceStrategies).toBe(0);
  });

  it('returns empty summary when ABC record is not referenced', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-other')],
      }),
    };
    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.totalUsageCount).toBe(0);
    expect(result.relatedSheetCount).toBe(0);
    expect(result.usages).toEqual([]);
  });

  it('finds single usage in one strategy', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1')],
      }),
    };

    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.totalUsageCount).toBe(1);
    expect(result.relatedSheetCount).toBe(1);
    expect(result.byStrategy.antecedentStrategies).toBe(1);
    expect(result.usages).toHaveLength(1);
    expect(result.usages[0]).toEqual({
      planningSheetId: 'sheet1',
      strategy: 'antecedentStrategies',
      strategyLabel: '先行事象戦略',
      count: 1,
    });
  });

  it('finds usages across multiple strategies in same sheet', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1')],
        teachingStrategies: [abcLink('abc-1')],
      }),
    };

    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.totalUsageCount).toBe(2);
    expect(result.relatedSheetCount).toBe(1);
    expect(result.byStrategy.antecedentStrategies).toBe(1);
    expect(result.byStrategy.teachingStrategies).toBe(1);
    expect(result.usages).toHaveLength(2);
  });

  it('finds usages across multiple sheets', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1')],
      }),
      sheet2: makeLinkMap({
        consequenceStrategies: [abcLink('abc-1')],
      }),
    };

    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.totalUsageCount).toBe(2);
    expect(result.relatedSheetCount).toBe(2);
    expect(result.byStrategy.antecedentStrategies).toBe(1);
    expect(result.byStrategy.consequenceStrategies).toBe(1);
    expect(result.usages).toHaveLength(2);
  });

  it('counts duplicates within same strategy correctly', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), abcLink('abc-1')],
      }),
    };

    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.totalUsageCount).toBe(2);
    expect(result.relatedSheetCount).toBe(1);
    expect(result.usages[0].count).toBe(2);
  });

  it('ignores PDCA links when searching for ABC', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), pdcaLink('abc-1')],
      }),
    };

    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.totalUsageCount).toBe(1);
  });

  it('sorts usages by count descending', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1')],
      }),
      sheet2: makeLinkMap({
        teachingStrategies: [abcLink('abc-1'), abcLink('abc-1'), abcLink('abc-1')],
      }),
      sheet3: makeLinkMap({
        consequenceStrategies: [abcLink('abc-1'), abcLink('abc-1')],
      }),
    };

    const result = getStrategyUsagesForAbcRecord('abc-1', allMaps);
    expect(result.usages[0].count).toBe(3);
    expect(result.usages[1].count).toBe(2);
    expect(result.usages[2].count).toBe(1);
  });
});

// ── getStrategyUsagesForPdcaItem ──

describe('getStrategyUsagesForPdcaItem', () => {
  it('returns empty summary when no evidence link maps exist', () => {
    const result = getStrategyUsagesForPdcaItem('pdca-1', {});
    expect(result.totalUsageCount).toBe(0);
    expect(result.relatedSheetCount).toBe(0);
    expect(result.usages).toEqual([]);
  });

  it('finds PDCA usage across sheets', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [pdcaLink('pdca-1')],
      }),
      sheet2: makeLinkMap({
        consequenceStrategies: [pdcaLink('pdca-1'), pdcaLink('pdca-1')],
      }),
    };

    const result = getStrategyUsagesForPdcaItem('pdca-1', allMaps);
    expect(result.totalUsageCount).toBe(3);
    expect(result.relatedSheetCount).toBe(2);
    expect(result.byStrategy.antecedentStrategies).toBe(1);
    expect(result.byStrategy.consequenceStrategies).toBe(2);
  });

  it('ignores ABC links when searching for PDCA', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [pdcaLink('pdca-1'), abcLink('pdca-1')],
      }),
    };

    const result = getStrategyUsagesForPdcaItem('pdca-1', allMaps);
    expect(result.totalUsageCount).toBe(1);
  });
});

// ── STRATEGY_LABELS ──

describe('STRATEGY_LABELS', () => {
  it('has Japanese labels for all strategies', () => {
    expect(STRATEGY_LABELS.antecedentStrategies).toBe('先行事象戦略');
    expect(STRATEGY_LABELS.teachingStrategies).toBe('教授戦略');
    expect(STRATEGY_LABELS.consequenceStrategies).toBe('後続事象戦略');
  });
});
