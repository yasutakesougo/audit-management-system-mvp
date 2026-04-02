import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  NURSE_OBS_CANDIDATES,
  NURSE_OBS_ESSENTIALS,
} from '../nurseObservationFields';

describe('Nurse Observations Drift Resistance', () => {
  const cands = NURSE_OBS_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (Temperature, ObservedAt, UserLookupId) が解決される', () => {
    const available = new Set(['Id', 'Title', 'Temperature', 'ObservedAt', 'UserLookupId', 'Pulse']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.temperature).toBe('Temperature');
    expect(fieldStatus.temperature.isDrifted).toBe(false);
    
    expect(resolved.observedAt).toBe('ObservedAt');
    expect(fieldStatus.observedAt.isDrifted).toBe(false);
    
    expect(resolved.userLookupId).toBe('UserLookupId');
    expect(fieldStatus.userLookupId.isDrifted).toBe(false);
  });

  it('Temp / ObsDate / cr013_usercode が解決される (drift)', () => {
    const available = new Set(['Temp', 'ObsDate', 'cr013_usercode']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.temperature).toBe('Temp');
    expect(fieldStatus.temperature.isDrifted).toBe(true);
    
    expect(resolved.observedAt).toBe('ObsDate');
    expect(fieldStatus.observedAt.isDrifted).toBe(true);
    
    expect(resolved.userLookupId).toBe('cr013_usercode');
    expect(fieldStatus.userLookupId.isDrifted).toBe(true);
  });

  it('必須チェック（observedAt, userLookupId, temperature）が機能する', () => {
    const available = new Set(['Temperature', 'ObservedAt', 'UserLookupId']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = NURSE_OBS_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('Temperature が欠落している場合に FAIL 判定', () => {
    const available = new Set(['ObservedAt', 'UserLookupId']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = NURSE_OBS_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
