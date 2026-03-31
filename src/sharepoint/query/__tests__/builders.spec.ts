/* eslint-disable no-restricted-syntax -- Expected output strings in builder contract tests; not real SP filter construction */
import { describe, it, expect } from 'vitest';
import { buildEq, buildNe, buildGe, buildLe, buildGt, buildLt, joinAnd, joinOr } from '../builders';

describe('OData query builders', () => {
  describe('buildEq', () => {
    it('wraps string value in single quotes', () => {
      expect(buildEq('UserCode', 'U001')).toBe("UserCode eq 'U001'");
    });

    it('emits bare number without quotes', () => {
      expect(buildEq('Score', 42)).toBe('Score eq 42');
    });

    it('emits bare boolean without quotes', () => {
      expect(buildEq('IsActive', true)).toBe('IsActive eq true');
      expect(buildEq('IsActive', false)).toBe('IsActive eq false');
    });

    it('escapes single quotes in string values', () => {
      expect(buildEq('Title', "O'Brien")).toBe("Title eq 'O''Brien'");
    });
  });

  describe('buildNe', () => {
    it('builds ne filter', () => {
      expect(buildNe('Status', 'deleted')).toBe("Status ne 'deleted'");
    });
  });

  describe('buildGe / buildLe / buildGt / buildLt', () => {
    it('builds ge filter', () => {
      expect(buildGe('RecordDate', '2026-03-01')).toBe("RecordDate ge '2026-03-01'");
    });

    it('builds le filter', () => {
      expect(buildLe('RecordDate', '2026-03-31')).toBe("RecordDate le '2026-03-31'");
    });

    it('builds gt filter', () => {
      expect(buildGt('Score', 0)).toBe('Score gt 0');
    });

    it('builds lt filter', () => {
      expect(buildLt('Score', 100)).toBe('Score lt 100');
    });
  });

  describe('joinAnd', () => {
    it('joins two filters with " and "', () => {
      expect(joinAnd(["UserCode eq 'U001'", "RecordDate ge '2026-03-01'"]))
        .toBe("UserCode eq 'U001' and RecordDate ge '2026-03-01'");
    });

    it('filters out falsy values', () => {
      expect(joinAnd(["UserCode eq 'U001'", '', null, undefined, false]))
        .toBe("UserCode eq 'U001'");
    });

    it('returns empty string when all falsy', () => {
      expect(joinAnd([null, undefined, false, ''])).toBe('');
    });
  });

  describe('joinOr', () => {
    it('joins two filters with " or "', () => {
      expect(joinOr(["Status eq 'active'", "Status eq 'pending'"]))
        .toBe("Status eq 'active' or Status eq 'pending'");
    });

    it('filters out falsy values', () => {
      expect(joinOr(["Status eq 'active'", null])).toBe("Status eq 'active'");
    });
  });
});
