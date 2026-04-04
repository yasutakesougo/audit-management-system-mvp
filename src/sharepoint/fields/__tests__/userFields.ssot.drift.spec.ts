/**
 * Users_Master / Separation List SSOT Drift Regression Tests
 * 
 * 確認事項:
 * 1. drift 列名 `Status` で `UsageStatus` が保存・解決される
 * 2. drift 列名 `IntensityTarget` で `IsHighIntensitySupportTarget` が保存・解決される
 * 3. `UserBenefit_Profile` の別名列 (DisabilitySupportLevel0 等) が SSOT 候補を通して解決される
 * 4. 候補未解決時に missing として検知可能である
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import {
  USERS_MASTER_CANDIDATES,
  USER_BENEFIT_PROFILE_CANDIDATES,
} from '../userFields';

describe('User Fields SSOT Drift Regression', () => {
  describe('Core List (Users_Master) Drift', () => {
    it('should resolve "Status" as usageStatus and "IntensityTarget" as isHighIntensitySupportTarget', () => {
      const available = new Set(['UserID', 'FullName', 'Status', 'IntensityTarget']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>
      );

      expect(resolved.usageStatus).toBe('Status');
      expect(fieldStatus.usageStatus.isDrifted).toBe(true);

      expect(resolved.isHighIntensitySupportTarget).toBe('IntensityTarget');
      expect(fieldStatus.isHighIntensitySupportTarget.isDrifted).toBe(true);
    });
  });

  describe('Separation List (UserBenefit_Profile) SSOT', () => {
    it('should resolve "DisabilitySupportLevel0" through common candidates', () => {
      const available = new Set(['UserID', 'RecipientCertNumber', 'DisabilitySupportLevel0']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>
      );

      expect(resolved.disabilitySupportLevel).toBe('DisabilitySupportLevel0');
      expect(fieldStatus.disabilitySupportLevel.isDrifted).toBe(true);
    });

    it('should resolve legacy "SupportLevel" as disabilitySupportLevel', () => {
      const available = new Set(['UserID', 'RecipientCertNumber', 'SupportLevel']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>
      );

      expect(resolved.disabilitySupportLevel).toBe('SupportLevel');
      expect(fieldStatus.disabilitySupportLevel.isDrifted).toBe(true);
    });
  });

  describe('Detection of Unresolved Candidates', () => {
    it('should report as missing when no candidates match', () => {
      const available = new Set(['UserID', 'SomeUnknownColumn']);
      const { resolved, missing } = resolveInternalNamesDetailed(
        available,
        {
          targetField: ['TargetColumn', 'AlternativeColumn']
        }
      );

      expect(resolved.targetField).toBeUndefined();
      expect(missing).toContain('targetField');
    });

    it('should handle completely drifted environment by keeping fields undefined', () => {
      const available = new Set(['Random1', 'Random2']);
      const { resolved, missing } = resolveInternalNamesDetailed(
        available,
        USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>
      );

      // 必須フィールドも解決されない
      expect(resolved.userId).toBeUndefined();
      expect(resolved.recipientCertNumber).toBeUndefined();
      expect(missing).toContain('userId');
      expect(missing).toContain('recipientCertNumber');
    });
  });
});
