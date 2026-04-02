import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  ISP_MASTER_CANDIDATES,
  ISP_MASTER_ESSENTIALS,
  PLANNING_SHEET_CANDIDATES,
  PROCEDURE_RECORD_CANDIDATES,
  PROCEDURE_RECORD_ESSENTIALS,
} from '../ispThreeLayerFields';

describe('ISP Three Layer Drift Resistance', () => {

  describe('PROCEDURE_RECORD_CANDIDATES (支援手順記録)', () => {
    const cands = PROCEDURE_RECORD_CANDIDATES as unknown as Record<string, string[]>;

    it('標準名が解決される', () => {
      const available = new Set(['Id', 'Title', 'UserCode', 'PlanningSheetId', 'RecordDate']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.userCode).toBe('UserCode');
      expect(fieldStatus.userCode.isDrifted).toBe(false);
    });

    it('cr013_userCode / cr013_recordDate が解決される (WARN)', () => {
      const available = new Set(['cr013_userCode', 'cr013_recordDate', 'PlanningSheetId']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.userCode).toBe('cr013_userCode');
      expect(fieldStatus.userCode.isDrifted).toBe(true);
      expect(resolved.recordDate).toBe('cr013_recordDate');
      expect(fieldStatus.recordDate.isDrifted).toBe(true);
    });

    it('必須チェック（UserCode, PlanningSheetId, RecordDate）が機能する', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode', 'PlanningSheetId', 'RecordDate']), cands);
      const essentials = PROCEDURE_RECORD_ESSENTIALS as unknown as string[];
      expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
    });

    it('必須項目欠落時に FAIL 判定', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode']), cands);
      const essentials = PROCEDURE_RECORD_ESSENTIALS as unknown as string[];
      expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
    });
  });

  describe('ISP_MASTER_CANDIDATES (個別支援計画マスター)', () => {
    const cands = ISP_MASTER_CANDIDATES as unknown as Record<string, string[]>;
    
    it('cr013_status / UsageStatus が Status として解決される (WARN)', () => {
      const available = new Set(['cr013_status', 'PlanStartDate', 'UserCode']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.status).toBe('cr013_status');
      expect(fieldStatus.status.isDrifted).toBe(true);
    });

    it('必須チェックが機能する', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode', 'PlanStartDate', 'Status']), cands);
      const essentials = ISP_MASTER_ESSENTIALS as unknown as string[];
      expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
    });
  });

  describe('PLANNING_SHEET_CANDIDATES (支援計画シート)', () => {
    const cands = PLANNING_SHEET_CANDIDATES as unknown as Record<string, string[]>;

    it('ISPLookupId が ISPId として解決される (WARN)', () => {
      const available = new Set(['ISPLookupId', 'UserCode', 'Status']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.ispId).toBe('ISPLookupId');
      expect(fieldStatus.ispId.isDrifted).toBe(true);
    });
  });

});
