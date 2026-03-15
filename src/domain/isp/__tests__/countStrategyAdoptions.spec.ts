import { describe, expect, it } from 'vitest';

import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';
import {
  countStrategyAdoptions,
  getTotalAdoptions,
  STRATEGY_KEYS,
  STRATEGY_LABELS,
} from '@/domain/isp/countStrategyAdoptions';

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

// ── Tests ──

describe('countStrategyAdoptions', () => {
  it('returns all zeros when no ABC record IDs provided', () => {
    const result = countStrategyAdoptions(new Set(), {
      sheet1: makeLinkMap({ antecedentStrategies: [abcLink('abc-1')] }),
    });
    expect(result).toEqual({
      antecedentStrategies: 0,
      teachingStrategies: 0,
      consequenceStrategies: 0,
    });
  });

  it('returns all zeros when no evidence link maps exist', () => {
    const result = countStrategyAdoptions(new Set(['abc-1', 'abc-2']), {});
    expect(result).toEqual({
      antecedentStrategies: 0,
      teachingStrategies: 0,
      consequenceStrategies: 0,
    });
  });

  it('counts ABC links matching user record IDs per strategy', () => {
    const userIds = new Set(['abc-1', 'abc-2', 'abc-3']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), abcLink('abc-2')],
        teachingStrategies: [abcLink('abc-3')],
        consequenceStrategies: [],
      }),
    };

    const result = countStrategyAdoptions(userIds, allMaps);
    expect(result).toEqual({
      antecedentStrategies: 2,
      teachingStrategies: 1,
      consequenceStrategies: 0,
    });
  });

  it('ignores PDCA links (only counts ABC)', () => {
    const userIds = new Set(['abc-1']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), pdcaLink('pdca-1')],
      }),
    };

    const result = countStrategyAdoptions(userIds, allMaps);
    expect(result.antecedentStrategies).toBe(1);
  });

  it('ignores ABC links not belonging to the user', () => {
    const userIds = new Set(['abc-1']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), abcLink('abc-other')],
      }),
    };

    const result = countStrategyAdoptions(userIds, allMaps);
    expect(result.antecedentStrategies).toBe(1);
  });

  it('aggregates across multiple planning sheets', () => {
    const userIds = new Set(['abc-1', 'abc-2']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1')],
      }),
      sheet2: makeLinkMap({
        antecedentStrategies: [abcLink('abc-2')],
        consequenceStrategies: [abcLink('abc-1')],
      }),
    };

    const result = countStrategyAdoptions(userIds, allMaps);
    expect(result.antecedentStrategies).toBe(2);
    expect(result.consequenceStrategies).toBe(1);
  });
});

describe('getTotalAdoptions', () => {
  it('sums all strategy counts', () => {
    expect(getTotalAdoptions({
      antecedentStrategies: 3,
      teachingStrategies: 2,
      consequenceStrategies: 1,
    })).toBe(6);
  });

  it('returns 0 for all-zero counts', () => {
    expect(getTotalAdoptions({
      antecedentStrategies: 0,
      teachingStrategies: 0,
      consequenceStrategies: 0,
    })).toBe(0);
  });
});

describe('STRATEGY_KEYS and STRATEGY_LABELS', () => {
  it('has 3 strategy keys', () => {
    expect(STRATEGY_KEYS).toHaveLength(3);
  });

  it('every key has a Japanese label', () => {
    for (const key of STRATEGY_KEYS) {
      expect(STRATEGY_LABELS[key]).toBeTruthy();
      expect(typeof STRATEGY_LABELS[key]).toBe('string');
    }
  });
});
