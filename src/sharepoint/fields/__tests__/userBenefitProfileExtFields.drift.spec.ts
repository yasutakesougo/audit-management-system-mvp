import { describe, expect, it } from 'vitest';
import { areEssentialFieldsResolved, resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import {
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_ESSENTIALS,
} from '../userFields';

const cands = USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>;
const essentials = USER_BENEFIT_PROFILE_EXT_ESSENTIALS as unknown as string[];

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(available, cands);
}

describe('USER_BENEFIT_PROFILE_EXT_CANDIDATES userId resolution', () => {
  it('keeps UserID as canonical when present', () => {
    const { resolved, fieldStatus } = resolve(new Set(['UserID', 'Title', 'RecipientCertNumber']));
    expect(resolved.userId).toBe('UserID');
    expect(fieldStatus.userId.isDrifted).toBe(false);
  });

  it('accepts Title as backward-compatible alias (drift)', () => {
    const { resolved, fieldStatus } = resolve(new Set(['Title', 'RecipientCertNumber']));
    expect(resolved.userId).toBe('Title');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });

  it('is healthy when userId and recipient cert are resolved', () => {
    const { resolved } = resolve(new Set(['Title', 'RecipientCertNumber']));
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });
});
