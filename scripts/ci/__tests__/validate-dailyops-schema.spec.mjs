// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  ESSENTIAL_FIELDS,
  OPTIONAL_FIELDS,
  validateSchema,
} from '../validate-dailyops-schema.logic.mjs';

// ── Happy path ──────────────────────────────────────────────────

describe('validateSchema', () => {
  const allFields = [...ESSENTIAL_FIELDS, ...OPTIONAL_FIELDS];

  it('passes when all fields are present', () => {
    const result = validateSchema(allFields);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.caseMismatch).toEqual([]);
    expect(result.optionalMissing).toEqual([]);
  });

  it('passes with extra fields present', () => {
    const result = validateSchema([...allFields, 'ContentType', 'Attachments']);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  // ── Essential field missing → FAIL ──────────────────────────

  it('fails when an essential field is missing', () => {
    const without = allFields.filter((f) => f !== 'kind');
    const result = validateSchema(without);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('kind');
  });

  it('fails when multiple essential fields are missing', () => {
    const result = validateSchema(['time', 'source']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(ESSENTIAL_FIELDS);
  });

  // ── Case mismatch → PASS with warning ───────────────────────

  it('detects case mismatch as warning (not failure)', () => {
    const drifted = allFields.map((f) =>
      f === 'targetType' ? 'TargetType' : f,
    );
    const result = validateSchema(drifted);
    expect(result.ok).toBe(true);
    expect(result.caseMismatch).toEqual([
      { expected: 'targetType', actual: 'TargetType' },
    ]);
  });

  // ── Optional field missing → PASS with warning ──────────────

  it('warns when optional field is missing but still passes', () => {
    const result = validateSchema(ESSENTIAL_FIELDS); // no optional fields
    expect(result.ok).toBe(true);
    expect(result.optionalMissing).toEqual(OPTIONAL_FIELDS);
  });

  // ── Edge cases ──────────────────────────────────────────────

  it('handles empty field list', () => {
    const result = validateSchema([]);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(ESSENTIAL_FIELDS);
    expect(result.optionalMissing).toEqual(OPTIONAL_FIELDS);
  });

  it('case mismatch on optional field does not appear in optionalMissing', () => {
    const drifted = [...ESSENTIAL_FIELDS, 'Time', 'Source'];
    const result = validateSchema(drifted);
    expect(result.ok).toBe(true);
    expect(result.optionalMissing).toEqual([]);
  });
});
