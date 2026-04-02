import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  SUPPORT_PLANS_CANDIDATES,
  SUPPORT_PLANS_ESSENTIALS,
} from '../supportPlanFields';

describe('Support Plans Drift Resistance', () => {
  const cands = SUPPORT_PLANS_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (DraftId, UserCode, FormDataJson) が解決される', () => {
    const available = new Set(['Id', 'DraftId', 'UserCode', 'FormDataJson', 'Status']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.draftId).toBe('DraftId');
    expect(fieldStatus.draftId.isDrifted).toBe(false);
    
    expect(resolved.userCode).toBe('UserCode');
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    
    expect(resolved.formDataJson).toBe('FormDataJson');
    expect(fieldStatus.formDataJson.isDrifted).toBe(false);
  });

  it('cr013_draftid / cr013_formdatajson が解決される (WARN)', () => {
    const available = new Set(['cr013_draftid', 'UserCode', 'cr013_formdatajson']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.draftId).toBe('cr013_draftid');
    expect(fieldStatus.draftId.isDrifted).toBe(true);
    
    expect(resolved.formDataJson).toBe('cr013_formdatajson');
    expect(fieldStatus.formDataJson.isDrifted).toBe(true);
  });

  it('必須チェック（draftId, userCode, formDataJson）が機能する', () => {
    const { resolved } = resolveInternalNamesDetailed(new Set(['DraftId', 'UserCode', 'FormDataJson']), cands);
    const essentials = SUPPORT_PLANS_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('formDataJson が欠落している場合に FAIL 判定', () => {
    const { resolved } = resolveInternalNamesDetailed(new Set(['DraftId', 'UserCode']), cands);
    const essentials = SUPPORT_PLANS_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
