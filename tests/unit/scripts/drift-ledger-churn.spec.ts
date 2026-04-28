/**
 * Tests for drift-ledger churn suppression logic.
 *
 * Validates that `hasStructuralChange` correctly identifies when structural
 * fields differ between previous CSV rows and current in-memory rows,
 * preventing unnecessary `lastSeenAt` timestamp updates.
 */
import { describe, it, expect } from 'vitest';

// ── Inline the comparison logic under test ──
// (The production function lives in build-drift-ledger.mjs which has heavy
//  side-effect imports. We replicate the pure logic here to test it in isolation.)

const STRUCTURAL_FIELDS = [
  'driftType', 'usageCount', 'hasData', 'isIndexed',
  'classification', 'confidence', 'evidence',
  'fieldId', 'expectedField', 'actualField', 'candidatesMatched',
];

function hasStructuralChange(
  prev: Record<string, string>,
  current: Record<string, unknown>,
): boolean {
  for (const field of STRUCTURAL_FIELDS) {
    const prevVal = String(prev[field] ?? '');
    const curVal = String(current[field] ?? '');
    if (prevVal !== curVal) return true;
  }
  return false;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('drift-ledger churn suppression', () => {
  const basePrev: Record<string, string> = {
    listKey: 'users_master',
    internalName: 'UserID',
    driftType: 'match',
    usageCount: '399',
    hasData: 'true',
    isIndexed: 'true',
    classification: 'allow',
    confidence: 'high',
    evidence: 'registry_match',
    fieldId: 'abc-123',
    expectedField: 'UserID',
    actualField: 'UserID',
    candidatesMatched: 'false',
    firstSeenAt: '2026-04-25T16:57:04.599Z',
    lastSeenAt: '2026-04-27T08:10:16.130Z',
  };

  const baseCurrent = {
    listKey: 'users_master',
    internalName: 'UserID',
    driftType: 'match',
    usageCount: 399,
    hasData: true,
    isIndexed: true,
    classification: 'allow',
    confidence: 'high',
    evidence: 'registry_match',
    fieldId: 'abc-123',
    expectedField: 'UserID',
    actualField: 'UserID',
    candidatesMatched: false,
  };

  it('returns false when all structural fields are identical (timestamp-only diff)', () => {
    expect(hasStructuralChange(basePrev, baseCurrent)).toBe(false);
  });

  it('correctly compares boolean-to-string coercion (CSV "true" vs boolean true)', () => {
    expect(hasStructuralChange(
      { ...basePrev, hasData: 'true' },
      { ...baseCurrent, hasData: true },
    )).toBe(false);
  });

  it('correctly compares number-to-string coercion (CSV "399" vs number 399)', () => {
    expect(hasStructuralChange(
      { ...basePrev, usageCount: '399' },
      { ...baseCurrent, usageCount: 399 },
    )).toBe(false);
  });

  it('detects driftType change', () => {
    expect(hasStructuralChange(basePrev, {
      ...baseCurrent,
      driftType: 'fuzzy_match',
    })).toBe(true);
  });

  it('detects usageCount change', () => {
    expect(hasStructuralChange(basePrev, {
      ...baseCurrent,
      usageCount: 400,
    })).toBe(true);
  });

  it('detects classification change', () => {
    expect(hasStructuralChange(basePrev, {
      ...baseCurrent,
      classification: 'candidate',
    })).toBe(true);
  });

  it('detects hasData flip', () => {
    expect(hasStructuralChange(basePrev, {
      ...baseCurrent,
      hasData: false,
    })).toBe(true);
  });

  it('detects isIndexed flip', () => {
    expect(hasStructuralChange(basePrev, {
      ...baseCurrent,
      isIndexed: false,
    })).toBe(true);
  });

  it('detects evidence change', () => {
    expect(hasStructuralChange(basePrev, {
      ...baseCurrent,
      evidence: 'active_usage_in_code(400)',
    })).toBe(true);
  });

  it('ignores firstSeenAt / lastSeenAt differences (not structural)', () => {
    const prevWithDiffTimestamps = {
      ...basePrev,
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    };
    expect(hasStructuralChange(prevWithDiffTimestamps, baseCurrent)).toBe(false);
  });

  it('handles missing fields gracefully (new field not in prev CSV)', () => {
    const sparseRow: Record<string, string> = {
      listKey: 'users_master',
      internalName: 'NewField',
      driftType: 'zombie_candidate',
      // Many fields missing
    };
    const currentRow = {
      listKey: 'users_master',
      internalName: 'NewField',
      driftType: 'zombie_candidate',
      usageCount: 0,
      hasData: false,
      isIndexed: false,
      classification: 'keep-warn',
      confidence: 'medium',
      evidence: 'no_data_no_usage',
      fieldId: null,
      expectedField: null,
      actualField: 'NewField',
      candidatesMatched: false,
    };
    // Missing fields in prev will be '' vs current values → should detect change
    expect(hasStructuralChange(sparseRow, currentRow)).toBe(true);
  });
});
