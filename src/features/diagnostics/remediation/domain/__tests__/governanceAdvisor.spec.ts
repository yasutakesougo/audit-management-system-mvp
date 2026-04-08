import { describe, it, expect } from 'vitest';
import { deriveGovernanceRecommendations } from '../governanceAdvisor';
import { type SpListEntry } from '@/sharepoint/spListRegistry';
import { type FieldSkipStreakResult } from '../../../drift/hooks/usePersistentDrift';

describe('governanceAdvisor v4.3 (Operational Readiness)', () => {
  const mockRegistry: SpListEntry[] = [
    {
      key: 'users_master',
      displayName: '利用者マスタ',
      resolve: () => 'Users',
      provisioningFields: [
        { internalName: 'FullName', type: 'Text', required: true },
      ],
      operations: ['R'] as any,
      category: 'user' as any,
      essentialFields: ['FullName'],
      lifecycle: 'required',
    }
  ];

  const createMockDrift = (partial: Partial<FieldSkipStreakResult>): FieldSkipStreakResult => ({
    reasonKey: 'users_master:FullName',
    streak: 1,
    status: 'persistent_drift',
    ...partial
  });

  it('基盤マスタの長期異常(streak=10)は、high confidence かつ autoExecutable になる', () => {
    const signals = [createMockDrift({ streak: 10 })];
    const recs = deriveGovernanceRecommendations(mockRegistry, signals);
    
    expect(recs[0].action.confidence).toBe('high');
    expect(recs[0].action.autoExecutable).toBe(true);
  });

  it('初期ドリフト(streak=3)は autoExecutable ではない', () => {
    const signals = [createMockDrift({ streak: 3 })];
    const recs = deriveGovernanceRecommendations(mockRegistry, signals);
    
    expect(recs[0].action.autoExecutable).toBe(false);
    expect(recs[0].action.confidence).toBe('medium');
  });

  it('標準リストの異常は、長期であっても autoExecutable にはならない (慎重性)', () => {
    const registryWithAudit = [...mockRegistry, {
      key: 'audit_logs',
      displayName: '監査ログ',
      resolve: () => 'AuditLogs',
      provisioningFields: [{ internalName: 'Log', type: 'Text' }],
      operations: ['R'] as any,
      category: 'ops' as any,
      essentialFields: ['Log'],
      lifecycle: 'required',
    } as any];
    
    const signals = [createMockDrift({ reasonKey: 'audit_logs:Log', streak: 10 })];
    const recs = deriveGovernanceRecommendations(registryWithAudit, signals);
    
    expect(recs[0].action.autoExecutable).toBe(false);
    expect(recs[0].action.confidence).toBe('high'); // 確信度は高いが自動化はしない
  });
});
