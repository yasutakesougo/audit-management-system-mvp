import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  BILLING_SUMMARY_CANDIDATES,
  BILLING_SUMMARY_ESSENTIALS,
} from '../billingFields';

describe('BILLING_SUMMARY_CANDIDATES drift', () => {
  const allFieldCandidates = BILLING_SUMMARY_CANDIDATES as unknown as Record<string, string[]>;

  function resolve(available: Set<string>) {
    return resolveInternalNamesDetailed(available, allFieldCandidates);
  }


  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title', 'UserId', 'YearMonth', 'TotalDays', 'WorkingDays', 'LastAggregatedAt'
    ]);
    const { resolved, missing, fieldStatus } = resolve(available);

    expect(resolved.userId).toBe('UserId');
    expect(resolved.yearMonth).toBe('YearMonth');
    const essentials = BILLING_SUMMARY_ESSENTIALS as unknown as string[];
    essentials.forEach(key => {
      expect(resolved[key]).toBeDefined();
      expect(missing).not.toContain(key);
    });
    expect(fieldStatus.userId.isDrifted).toBe(false);
  });

  it('空白エンコード名 (_x0020_) が解決される (WARN)', () => {
    const available = new Set([
      'Id', 'Title', 'User_x0020_Id', 'Year_x0020_Month'
    ]);
    const { resolved, fieldStatus } = resolve(available);

    expect(resolved.userId).toBe('User_x0020_Id');
    expect(resolved.yearMonth).toBe('Year_x0020_Month');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });
  
  it('KPI_TotalDays が TotalDays より優先される', () => {
    const available = new Set([
      'KPI_TotalDays', 'TotalDays', 'Total_x0020_Days'
    ]);
    const { resolved } = resolve(available);
    expect(resolved.totalDays).toBe('KPI_TotalDays');
  });

  it('必須フィールドが揃えば isHealthy=true', () => {
    const available = new Set(['UserId', 'YearMonth', 'TotalDays', 'WorkingDays']);
    const { resolved } = resolve(available);
    const essentials = BILLING_SUMMARY_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('UserId が完全に欠落していれば isHealthy=false', () => {
    const available = new Set(['YearMonth', 'TotalDays', 'WorkingDays']);
    const { resolved } = resolve(available);
    const essentials = BILLING_SUMMARY_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
