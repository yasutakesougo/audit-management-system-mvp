/**
 * Users_Master drift 耐性テスト
 *
 * USERS_MASTER_CANDIDATES が resolveInternalNamesDetailed を通して
 * 様々な drift パターンを吸収できることを確認する。
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  USERS_MASTER_CANDIDATES,
  USERS_MASTER_ESSENTIALS,
} from '../userFields';

describe('USERS_MASTER_CANDIDATES drift', () => {
  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title', 'UserID', 'FullName', 'Furigana', 'FullNameKana',
      'ContractDate', 'ServiceStartDate', 'ServiceEndDate',
      'IsHighIntensitySupportTarget', 'IsSupportProcedureTarget',
      'IsActive', 'UsageStatus', 'AttendanceDays',
      'LastAssessmentDate', 'BehaviorScore', 'ChildBehaviorScore',
      'ServiceTypesJson', 'EligibilityCheckedAt'
    ]);
    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.userId).toBe('UserID');
    expect(resolved.fullName).toBe('FullName');
    expect(resolved.isActive).toBe('IsActive');
    const essentials = USERS_MASTER_ESSENTIALS as unknown as string[];
    essentials.forEach(key => {
      expect(resolved[key]).toBeDefined();
      expect(missing).not.toContain(key);
    });
    expect(fieldStatus.userId.isDrifted).toBe(false);
    expect(fieldStatus.fullName.isDrifted).toBe(false);
  });

  it('cr013_ プレフィックス付き内部名が解決される', () => {
    const available = new Set([
      'Id', 'Title', 'cr013_userId', 'cr013_fullName', 'cr013_isActive', 'cr013_usageStatus'
    ]);
    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.userId).toBe('cr013_userId');
    expect(resolved.fullName).toBe('cr013_fullName');
    expect(resolved.isActive).toBe('cr013_isActive');
    expect(fieldStatus.userId.isDrifted).toBe(true);
    expect(missing).not.toContain('userId');
    expect(missing).not.toContain('fullName');
  });

  it('SharePoint 自動付与サフィックス (FullName_Zombie) が解決される', () => {
    const available = new Set([
      'UserID', 'FullName_Zombie', 'IsActive', 'UsageStatus'
    ]);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.fullName).toBe('FullName_Zombie');
    expect(fieldStatus.fullName.isDrifted).toBe(true);
  });

  it('代替名 (Active, UserCode) が解決される', () => {
    const available = new Set([
      'UserCode', 'Name', 'Active', 'Status'
    ]);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.userId).toBe('UserCode');
    expect(resolved.fullName).toBe('Name');
    expect(resolved.isActive).toBe('Active');
    expect(resolved.usageStatus).toBe('Status');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });

  it('必須フィールド (userId, fullName, isActive, usageStatus) が揃えば isHealthy=true', () => {
    const available = new Set([
      'UserID', 'FullName', 'IsActive', 'UsageStatus'
    ]);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = USERS_MASTER_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('UserID が完全に欠落していれば isHealthy=false', () => {
    const available = new Set([
      'FullName', 'IsActive', 'UsageStatus'
    ]);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = USERS_MASTER_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });

  it('optional なフィールドの欠落は isHealthy に影響しない', () => {
    const available = new Set([
      'UserID', 'FullName', 'IsActive', 'UsageStatus'
      // Furigana なし
    ]);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = USERS_MASTER_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
    expect(resolved.furigana).toBeUndefined();
  });
});
