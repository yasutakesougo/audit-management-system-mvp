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
    expect(result.fieldStatus.score.isDrifted).toBe(false);
  });

  it('should detect suffixed names as drifted', () => {
    const available = new Set(['FullName0', 'UserID1']);
    const candidates = {
      fullName: ['FullName'],
      userId: ['UserID']
    };

    const result = resolveInternalNamesDetailed(available, candidates);
    
    expect(result.resolved.fullName).toBe('FullName0');
    expect(result.fieldStatus.fullName.isDrifted).toBe(true);
    expect(result.resolved.userId).toBe('UserID1');
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
});
