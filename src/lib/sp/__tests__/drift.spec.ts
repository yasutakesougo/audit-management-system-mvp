import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed } from '../helpers';

describe('Drift Detection (helpers.ts)', () => {
  it('should detect exact match as NOT drifted', () => {
    const available = new Set(['FullName', 'UserID', 'Compliance_x0020_Score']);
    const candidates = {
      fullName: ['FullName'],
      userId: ['UserID'],
      score: ['Score', 'Compliance_x0020_Score']
    };

    const result = resolveInternalNamesDetailed(available, candidates);

    expect(result.resolved.fullName).toBe('FullName');
    expect(result.fieldStatus.fullName.isDrifted).toBe(false);
    expect(result.resolved.score).toBe('Compliance_x0020_Score');
    expect(result.fieldStatus.score.isDrifted).toBe(true);
  });

  it('should detect suffixed names as drifted', () => {
    const available = new Set(['TestField0', 'TestField1']);
    const candidates = {
      fullName: ['TestField'],
      userId: ['TestField']
    };

    const result = resolveInternalNamesDetailed(available, candidates);

    expect(result.resolved.fullName).toBe('TestField0');
    expect(result.fieldStatus.fullName.isDrifted).toBe(true);
    expect(result.resolved.userId).toBe('TestField1');
    expect(result.fieldStatus.userId.isDrifted).toBe(true);
  });

  it('should NOT match names with non-numeric suffixes if not in candidates', () => {
    const available = new Set(['FullName_Suffix']);
    const candidates = {
      fullName: ['FullName']
    };

    const result = resolveInternalNamesDetailed(available, candidates);

    expect(result.resolved.fullName).toBeUndefined();
  });
  it('should match names truncated at 32 characters (Strategy E)', () => {
    const available = new Set(['Recipient_x0020_Cert_x0020_Numbe']);
    const candidates = {
      recipientCertNumber: ['Recipient Cert Number']
    };

    const result = resolveInternalNamesDetailed(available, candidates);

    expect(result.resolved.recipientCertNumber).toBe('Recipient_x0020_Cert_x0020_Numbe');
    expect(result.fieldStatus.recipientCertNumber.isDrifted).toBe(true);
    expect(result.fieldStatus.recipientCertNumber.driftType).toBe('truncation');
  });

  it('should match very long internal names truncated at 32 characters', () => {
    const available = new Set(['VeryLongFieldNameWithManyCharact']);
    const candidates = {
      veryLong: ['VeryLongFieldNameWithManyCharactersToTheMoon']
    };

    const result = resolveInternalNamesDetailed(available, candidates);

    expect(result.resolved.veryLong).toBe('VeryLongFieldNameWithManyCharact');
    expect(result.fieldStatus.veryLong.isDrifted).toBe(true);
    expect(result.fieldStatus.veryLong.driftType).toBe('fuzzy_match');
  });
});
