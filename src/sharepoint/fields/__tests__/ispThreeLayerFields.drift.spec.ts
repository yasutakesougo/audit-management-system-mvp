/**
 * ISP Three Layer drift 耐性テスト
 *
 * ISP_MASTER / PLANNING_SHEET / PROCEDURE_RECORD の各レイヤーについて
 * resolveInternalNamesDetailed による drift 吸収を確認する。
 *
 * シナリオ（各レイヤー共通）:
 *  1. 標準名が解決される
 *  2. cr013_ prefix drift を吸収
 *  3. 代替名 drift を吸収
 *  4. 必須フィールドが揃えば isHealthy=true
 *  5. 必須フィールド欠落で isHealthy=false（各ケース）
 *  6. optional 欠落でも isHealthy=true（WARN 水準）
 *  7. unresolved キーが missing として検知される
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  ISP_MASTER_CANDIDATES,
  ISP_MASTER_ESSENTIALS,
  PLANNING_SHEET_CANDIDATES,
  PLANNING_SHEET_ESSENTIALS,
  PROCEDURE_RECORD_CANDIDATES,
  PROCEDURE_RECORD_ESSENTIALS,
} from '../ispThreeLayerFields';

// ════════════════════════════════════════════════════════════════════════════
// A. ISP_MASTER_CANDIDATES (個別支援計画マスター)
// ════════════════════════════════════════════════════════════════════════════

function resolveIsp(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    ISP_MASTER_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isIspHealthy(resolved: Record<string, string | undefined>) {
  const essentials = ISP_MASTER_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

describe('ISP_MASTER_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'UserCode', 'PlanStartDate', 'PlanEndDate', 'Status', 'VersionNo', 'IsCurrent',
  ]);

  it('必須3フィールドがすべて解決される', () => {
    const { resolved, missing } = resolveIsp(available);
    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.planStartDate).toBe('PlanStartDate');
    expect(resolved.status).toBe('Status');
    expect(missing).not.toContain('userCode');
    expect(missing).not.toContain('planStartDate');
    expect(missing).not.toContain('status');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolveIsp(available);
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    expect(fieldStatus.planStartDate.isDrifted).toBe(false);
    expect(fieldStatus.status.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolveIsp(available);
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

describe('ISP_MASTER_CANDIDATES — drift パターン', () => {
  it('cr013_userCode が userCode として解決される', () => {
    const available = new Set(['cr013_userCode', 'PlanStartDate', 'Status']);
    const { resolved, fieldStatus } = resolveIsp(available);
    expect(resolved.userCode).toBe('cr013_userCode');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
  });

  it('UserID が userCode として解決される', () => {
    const available = new Set(['UserID', 'PlanStartDate', 'Status']);
    const { resolved } = resolveIsp(available);
    expect(resolved.userCode).toBe('UserID');
  });

  it('cr013_planStartDate が planStartDate として解決される', () => {
    const available = new Set(['UserCode', 'cr013_planStartDate', 'Status']);
    const { resolved, fieldStatus } = resolveIsp(available);
    expect(resolved.planStartDate).toBe('cr013_planStartDate');
    expect(fieldStatus.planStartDate.isDrifted).toBe(true);
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('StartDate が planStartDate として解決される', () => {
    const available = new Set(['UserCode', 'StartDate', 'Status']);
    const { resolved } = resolveIsp(available);
    expect(resolved.planStartDate).toBe('StartDate');
  });

  it('cr013_status / UsageStatus が status として解決される', () => {
    const available = new Set(['UserCode', 'PlanStartDate', 'cr013_status']);
    const { resolved, fieldStatus } = resolveIsp(available);
    expect(resolved.status).toBe('cr013_status');
    expect(fieldStatus.status.isDrifted).toBe(true);
  });

  it('UsageStatus が status として解決される', () => {
    const available = new Set(['UserCode', 'PlanStartDate', 'UsageStatus']);
    const { resolved } = resolveIsp(available);
    expect(resolved.status).toBe('UsageStatus');
  });
});

describe('ISP_MASTER_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須3点のみでも isHealthy=true（最小構成）', () => {
    const { resolved } = resolveIsp(new Set(['UserCode', 'PlanStartDate', 'Status']));
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('userCode が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveIsp(new Set(['PlanStartDate', 'Status']));
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('planStartDate が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveIsp(new Set(['UserCode', 'Status']));
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('status が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveIsp(new Set(['UserCode', 'PlanStartDate']));
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('formDataJson / userSnapshotJson 欠落でも isHealthy=true（WARN 水準）', () => {
    const { resolved, missing } = resolveIsp(new Set(['UserCode', 'PlanStartDate', 'Status']));
    expect(isIspHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('formDataJson');
    expect(missing).toContain('userSnapshotJson');
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const { missing } = resolveIsp(new Set(['SomeUnknownFieldOnly']));
    expect(missing).toContain('userCode');
    expect(missing).toContain('planStartDate');
    expect(missing).toContain('status');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. PLANNING_SHEET_CANDIDATES (支援計画シート)
// ════════════════════════════════════════════════════════════════════════════

function resolveSheet(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    PLANNING_SHEET_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isSheetHealthy(resolved: Record<string, string | undefined>) {
  const essentials = PLANNING_SHEET_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

describe('PLANNING_SHEET_CANDIDATES — 標準名・drift', () => {
  it('標準名 (UserCode, Status) が解決される', () => {
    const available = new Set(['Id', 'Title', 'UserCode', 'ISPId', 'Status']);
    const { resolved, fieldStatus } = resolveSheet(available);
    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.status).toBe('Status');
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    expect(fieldStatus.status.isDrifted).toBe(false);
  });

  it('ISPLookupId が ispId として解決される（drift）', () => {
    const available = new Set(['UserCode', 'ISPLookupId', 'Status']);
    const { resolved, fieldStatus } = resolveSheet(available);
    expect(resolved.ispId).toBe('ISPLookupId');
    expect(fieldStatus.ispId.isDrifted).toBe(true);
  });

  it('cr013_status が status として解決される（drift）', () => {
    const available = new Set(['UserCode', 'cr013_status']);
    const { resolved, fieldStatus } = resolveSheet(available);
    expect(resolved.status).toBe('cr013_status');
    expect(fieldStatus.status.isDrifted).toBe(true);
  });
});

describe('PLANNING_SHEET_ESSENTIALS FAIL/WARN 境界', () => {
  it('userCode + status のみで isHealthy=true（最小構成）', () => {
    const { resolved } = resolveSheet(new Set(['UserCode', 'Status']));
    expect(isSheetHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('userCode が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveSheet(new Set(['Status']));
    expect(isSheetHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('status が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveSheet(new Set(['UserCode']));
    expect(isSheetHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('ispId / formDataJson 欠落でも isHealthy=true（WARN 水準）', () => {
    const { resolved, missing } = resolveSheet(new Set(['UserCode', 'Status']));
    expect(isSheetHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('ispId');
    expect(missing).toContain('formDataJson');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C. PROCEDURE_RECORD_CANDIDATES (支援手順書兼記録)
// ════════════════════════════════════════════════════════════════════════════

function resolveProc(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    PROCEDURE_RECORD_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isProcHealthy(resolved: Record<string, string | undefined>) {
  const essentials = PROCEDURE_RECORD_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

describe('PROCEDURE_RECORD_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'UserCode', 'PlanningSheetId', 'RecordDate', 'TimeSlot', 'Activity',
  ]);

  it('必須3フィールドがすべて解決される', () => {
    const { resolved } = resolveProc(available);
    expect(resolved.userCode).toBe('UserCode');
    expect(resolved.planningSheetId).toBe('PlanningSheetId');
    expect(resolved.recordDate).toBe('RecordDate');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolveProc(available);
    expect(fieldStatus.userCode.isDrifted).toBe(false);
    expect(fieldStatus.planningSheetId.isDrifted).toBe(false);
    expect(fieldStatus.recordDate.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolveProc(available);
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

describe('PROCEDURE_RECORD_CANDIDATES — drift パターン', () => {
  it('cr013_userCode が userCode として解決される', () => {
    const available = new Set(['cr013_userCode', 'PlanningSheetId', 'RecordDate']);
    const { resolved, fieldStatus } = resolveProc(available);
    expect(resolved.userCode).toBe('cr013_userCode');
    expect(fieldStatus.userCode.isDrifted).toBe(true);
  });

  it('PlanningSheetLookupId が planningSheetId として解決される', () => {
    const available = new Set(['UserCode', 'PlanningSheetLookupId', 'RecordDate']);
    const { resolved, fieldStatus } = resolveProc(available);
    expect(resolved.planningSheetId).toBe('PlanningSheetLookupId');
    expect(fieldStatus.planningSheetId.isDrifted).toBe(true);
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('cr013_recordDate が recordDate として解決される', () => {
    const available = new Set(['UserCode', 'PlanningSheetId', 'cr013_recordDate']);
    const { resolved, fieldStatus } = resolveProc(available);
    expect(resolved.recordDate).toBe('cr013_recordDate');
    expect(fieldStatus.recordDate.isDrifted).toBe(true);
  });

  it('Date が recordDate として解決される', () => {
    const available = new Set(['UserCode', 'PlanningSheetId', 'Date']);
    const { resolved } = resolveProc(available);
    expect(resolved.recordDate).toBe('Date');
  });
});

describe('PROCEDURE_RECORD_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須3点のみでも isHealthy=true（最小構成）', () => {
    const { resolved } = resolveProc(new Set(['UserCode', 'PlanningSheetId', 'RecordDate']));
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('userCode が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveProc(new Set(['PlanningSheetId', 'RecordDate']));
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('planningSheetId が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveProc(new Set(['UserCode', 'RecordDate']));
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('recordDate が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolveProc(new Set(['UserCode', 'PlanningSheetId']));
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('timeSlot / activity / procedureText 欠落でも isHealthy=true（WARN 水準）', () => {
    const { resolved, missing } = resolveProc(new Set(['UserCode', 'PlanningSheetId', 'RecordDate']));
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('timeSlot');
    expect(missing).toContain('activity');
    expect(missing).toContain('procedureText');
  });

  it('drift 経由3点でも isHealthy=true', () => {
    const { resolved } = resolveProc(new Set(['cr013_userCode', 'PlanningSheetLookupId', 'cr013_recordDate']));
    expect(isProcHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const { missing } = resolveProc(new Set(['SomeUnknownFieldOnly']));
    expect(missing).toContain('userCode');
    expect(missing).toContain('planningSheetId');
    expect(missing).toContain('recordDate');
  });
});
