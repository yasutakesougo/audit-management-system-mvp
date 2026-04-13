import { describe, it, expect } from 'vitest';
import { sanitizeForm } from '../helpers';
import { FIELD_LIMITS } from '../../types';

describe('Schema Migration & Normalization', () => {
  it('should normalize partial legacy data by filling missing fields with defaults', () => {
    // Legacy data missing new fields like ibdEnvAdjustment
    const legacyData = {
      serviceUserName: 'Legacy User',
      supportLevel: 'Level 3',
    };

    const sanitized = sanitizeForm(legacyData as any);

    expect(sanitized.serviceUserName).toBe('Legacy User');
    expect(sanitized.supportLevel).toBe('Level 3');
    // New fields should be empty strings, not undefined
    expect(sanitized.ibdEnvAdjustment).toBe('');
    expect(sanitized.userRole).toBe('');
    expect(sanitized.attendingDays).toBe('');
  });

  it('should preserve existing data while adding new fields', () => {
    // Simulate loading data where some new keys are missing
    const partialData = {
      serviceUserName: 'Overwritten User',
      // missing attendingDays
    };

    const result = sanitizeForm(partialData as any);
    expect(result.serviceUserName).toBe('Overwritten User');
    expect(result.attendingDays).toBe(''); // Default from createEmptyForm()
  });

  it('should sanitize values while normalizing', () => {
    const data = {
      serviceUserName: 'A'.repeat(200), // Exceeds limit of 80
    };

    const sanitized = sanitizeForm(data as any);
    expect(sanitized.serviceUserName.length).toBe(FIELD_LIMITS.serviceUserName);
    expect(sanitized.attendingDays).toBe('');
  });

  it('should handle null or undefined input gracefully', () => {
    expect(sanitizeForm(undefined).serviceUserName).toBe('');
  });
});
