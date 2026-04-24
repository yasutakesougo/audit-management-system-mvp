import { describe, it, expect } from 'vitest';
import { 
  normalizeClearableValue, 
  getCaseInsensitiveValue, 
  buildMappedPayload, 
  isNoopPayload 
} from '../repositoryUtils';

describe('repositoryUtils', () => {
  describe('normalizeClearableValue', () => {
    it('returns undefined as-is (Skip contract)', () => {
      expect(normalizeClearableValue(undefined)).toBeUndefined();
    });

    it('returns null as-is (Clear contract)', () => {
      expect(normalizeClearableValue(null)).toBeNull();
    });

    it('converts empty string to null (Clear contract)', () => {
      expect(normalizeClearableValue('')).toBeNull();
    });

    it('converts whitespace string to null (Sanitization contract)', () => {
      expect(normalizeClearableValue('   ')).toBeNull();
    });

    it('returns actual values as-is', () => {
      expect(normalizeClearableValue('A-Course')).toBe('A-Course');
      expect(normalizeClearableValue(123)).toBe(123);
      expect(normalizeClearableValue(true)).toBe(true);
    });
  });

  describe('getCaseInsensitiveValue', () => {
    const source = {
      UserID: 'U001',
      FullName: 'Test User',
      isActive: true
    };

    it('finds value with exact match', () => {
      expect(getCaseInsensitiveValue(source, 'UserID')).toBe('U001');
    });

    it('finds value with camelCase to PascalCase match', () => {
      expect(getCaseInsensitiveValue(source, 'userId')).toBe('U001');
      expect(getCaseInsensitiveValue(source, 'fullName')).toBe('Test User');
    });

    it('finds value with PascalCase to camelCase match', () => {
      expect(getCaseInsensitiveValue(source, 'IsActive')).toBe(true);
    });

    it('returns undefined if no match found', () => {
      expect(getCaseInsensitiveValue(source, 'nonExistent')).toBeUndefined();
    });
  });

  describe('buildMappedPayload', () => {
    const mapping = {
      userId: 'UserID',
      fullName: 'Title',
      transportCourse: 'CourseName',
      remarks: 'Comment'
    };

    it('builds payload with case-insensitive mapping and normalization', () => {
      const input = {
        UserID: 'U001',
        fullName: 'New Name',
        TransportCourse: '', // should be null
        // remarks is missing, should be undefined and skipped
      };

      const result = buildMappedPayload({ input, mapping });

      expect(result).toEqual({
        UserID: 'U001',
        Title: 'New Name',
        CourseName: null
      });
      expect(result).not.toHaveProperty('Comment');
    });

    it('skips fields not in mapping', () => {
      const input = {
        UnknownField: 'Value',
        UserID: 'U001'
      };
      const result = buildMappedPayload({ input, mapping });
      expect(result).toEqual({ UserID: 'U001' });
    });
  });

  describe('isNoopPayload', () => {
    it('returns true for empty object', () => {
      expect(isNoopPayload({})).toBe(true);
    });

    it('returns false if keys exist', () => {
      expect(isNoopPayload({ Title: 'A' })).toBe(false);
    });
  });
});
