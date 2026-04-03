import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { PLANNING_SHEET_CANDIDATES, PLANNING_SHEET_ESSENTIALS } from '../ispThreeLayerFields';

describe('PLANNING_SHEET_CANDIDATES drift', () => {
  const allCandidates = PLANNING_SHEET_CANDIDATES as unknown as Record<string, string[]>;
  const essentials = PLANNING_SHEET_ESSENTIALS as unknown as string[];

  it('標準名 (UserCode, Status 等) がそのまま解決される（drift なし）', () => {
    const available = new Set(['Id', 'Title', 'UserCode', 'Status', 'VersionNo', 'IsCurrent', 'FormDataJson', 'ISPId']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, allCandidates);

    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.status).toBe('Status');
    expect(fieldStatus.userCode.isDrifted).toBe(false);
  });

  it('UserID や UsageStatus などの別名でも解決される（drift あり）', () => {
    const available = new Set(['Id', 'Title', 'UserID', 'UsageStatus', 'cr013_formDataJson']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, allCandidates);

    expect(resolved.userCode).toBe('UserID');
    expect(resolved.status).toBe('UsageStatus');
    expect(resolved.formDataJson).toBe('cr013_formDataJson');

    expect(fieldStatus.userCode.isDrifted).toBe(true);
    expect(fieldStatus.status.isDrifted).toBe(true);
  });

  expect(essentials).toContain('userCode');
  expect(essentials).toContain('status');

  it('必須フィールド (userCode) が欠落している場合に検出できる', () => {
    const available = new Set(['Id', 'Title', 'Status']); // UserCode is missing
    const { resolved } = resolveInternalNamesDetailed(available, allCandidates);
    
    const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
    expect(isHealthy).toBe(false);
  });

  it('任意フィールド (ispId) が欠落していても必須が揃っていれば Healthy', () => {
    const available = new Set(['Id', 'Title', 'UserCode', 'Status']); // ISPId is missing but not essential
    const { resolved } = resolveInternalNamesDetailed(available, allCandidates);

    const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
    expect(isHealthy).toBe(true);
    expect(resolved.ispId).toBeUndefined();
  });
});
