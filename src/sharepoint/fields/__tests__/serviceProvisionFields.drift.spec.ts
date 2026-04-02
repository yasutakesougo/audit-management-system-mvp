import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  SERVICE_PROVISION_CANDIDATES,
  SERVICE_PROVISION_ESSENTIALS,
} from '../serviceProvisionFields';

describe('SERVICE_PROVISION_CANDIDATES drift', () => {
  const allFieldCandidates = SERVICE_PROVISION_CANDIDATES as unknown as Record<string, string[]>;

  function resolve(available: Set<string>) {
    return resolveInternalNamesDetailed(available, allFieldCandidates);
  }

  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title', 'EntryKey', 'UserCode', 'RecordDate', 'Status',
      'StartHHMM', 'EndHHMM', 'HasTransport', 'HasTransportPickup',
      'HasTransportDropoff', 'HasMeal', 'HasBath', 'HasExtended',
      'HasAbsentSupport', 'Note', 'Source', 'UpdatedByUPN'
    ]);
    const { resolved, missing, fieldStatus } = resolve(available);

    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.recordDate).toBe('RecordDate');
    expect(resolved.status).toBe('Status');
    expect(missing).toHaveLength(0);
    expect(fieldStatus.userCode.isDrifted).toBe(false);
  });

  it('cr013_ プレフィックス付き内部名が解決される (WARN)', () => {
    const available = new Set([
      'Id', 'Title', 'cr013_userCode', 'cr013_recordDate', 'cr013_status'
    ]);
    const { resolved, fieldStatus } = resolve(available);

    expect(resolved.userCode).toBe('cr013_userCode');
    expect(resolved.recordDate).toBe('cr013_recordDate');
    expect(resolved.status).toBe('cr013_status');
    // 基準名 (UserCode / RecordDate / Status) ではないため isDrifted=true
    expect(fieldStatus.userCode.isDrifted).toBe(true);
    expect(fieldStatus.recordDate.isDrifted).toBe(true);
  });

  it('UserID / Date などの代替名が解決される (WARN)', () => {
    const available = new Set([
      'Id', 'Title', 'UserID', 'Date', 'UsageStatus'
    ]);
    const { resolved, fieldStatus } = resolve(available);

    expect(resolved.userCode).toBe('UserID');
    expect(resolved.recordDate).toBe('Date');
    expect(resolved.status).toBe('UsageStatus');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
  });

  it('必須フィールド (userCode, recordDate, status) が揃えば isHealthy=true', () => {
    const available = new Set(['UserCode', 'RecordDate', 'Status']);
    const { resolved } = resolve(available);
    const essentials = SERVICE_PROVISION_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('UserCode が完全に欠落していれば isHealthy=false', () => {
    const available = new Set(['RecordDate', 'Status']);
    const { resolved } = resolve(available);
    const essentials = SERVICE_PROVISION_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
