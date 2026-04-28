import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  STAFF_MASTER_CANDIDATES,
  STAFF_MASTER_ESSENTIALS,
} from '../staffFields';

describe('STAFF_MASTER_CANDIDATES drift', () => {
  const allFieldCandidates = STAFF_MASTER_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title', 'StaffID', 'FullName', 'RBACRole', 'IsActive',
      'Furigana', 'FullNameKana', 'JobTitle', 'Role', 'Department',
      'HireDate', 'ResignDate', 'Email', 'Phone', 'WorkDays', 'BaseWorkingDays',
      'BaseShiftStartTime', 'BaseShiftEndTime', 'Certifications',
      'HasPracticalTraining', 'HasBasicTraining', 'HasBehaviorGuidanceTraining',
      'HasCorePersonTraining', 'CertificationCheckedAt'
    ]);
    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );

    expect(resolved.staffId).toBe('StaffID');
    expect(resolved.fullName).toBe('FullName');
    expect(resolved.isActive).toBe('IsActive');
    expect(missing).toHaveLength(0);
    expect(fieldStatus.staffId.isDrifted).toBe(false);
    expect(fieldStatus.fullName.isDrifted).toBe(false);
  });

  it('Staff_x0020_ID / Full_x0020_Name などのスペース付き内部名が解決される (WARN)', () => {
    const available = new Set([
      'Id', 'Title', 'Staff_x0020_ID', 'Full_x0020_Name', 'RBACRole', 'Active'
    ]);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );

    expect(resolved.staffId).toBe('Staff_x0020_ID');
    expect(resolved.fullName).toBe('Full_x0020_Name');
    expect(resolved.isActive).toBe('Active');
    // 基準名 (StaffID / FullName / IsActive) ではないため isDrifted=true
    expect(fieldStatus.staffId.isDrifted).toBe(true);
    expect(fieldStatus.fullName.isDrifted).toBe(true);
    expect(fieldStatus.isActive.isDrifted).toBe(true);
  });

  it('必須フィールド (staffId, fullName, rbacRole, isActive) が揃えば isHealthy=true', () => {
    // JobTitle must be present so that `jobTitle` candidates resolve to 'JobTitle'
    // and don't consume 'Role' (which is needed by the `role` essential).
    const available = new Set([
      'StaffID', 'FullName', 'JobTitle', 'Role', 'RBACRole', 'IsActive', 'Department'
    ]);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );
    const essentials = STAFF_MASTER_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('StaffID が完全に欠落していれば isHealthy=false', () => {
    const available = new Set(['FullName', 'RBACRole', 'IsActive']);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );
    const essentials = STAFF_MASTER_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
