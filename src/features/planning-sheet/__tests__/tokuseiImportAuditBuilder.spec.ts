import { describe, expect, it } from 'vitest';
import type { ImportAuditRecord } from '../stores/importAuditStore';
import { emptyBridgeResult } from '../tokuseiToPlanningBridge';
import {
  buildTokuseiImportAuditPayload,
  hasAlreadyImportedTokusei,
} from '../tokuseiImportAuditBuilder';

describe('tokuseiImportAuditBuilder', () => {
  describe('buildTokuseiImportAuditPayload', () => {
    it('should build payload with correct structure and summary for empty result', () => {
      const bridgeResult = emptyBridgeResult('tokusei-abc');
      
      const payload = buildTokuseiImportAuditPayload({
        planningSheetId: 'sheet-1',
        importedBy: 'Test User',
        tokuseiResponseId: 'tokusei-abc',
        bridgeResult,
        now: '2026-05-17T00:00:00Z',
      });

      expect(payload).toEqual({
        planningSheetId: 'sheet-1',
        importedAt: '2026-05-17T00:00:00Z',
        importedBy: 'Test User',
        assessmentId: null,
        tokuseiResponseId: 'tokusei-abc',
        mode: 'with-tokusei',
        affectedFields: [],
        provenance: [],
        summaryText: '特性アンケート取込 (反映データなし)',
      });
    });

    it('should build payload with provenance and summary texts when result has items', () => {
      const bridgeResult = emptyBridgeResult('tokusei-def');
      bridgeResult.audit.fieldsTouched = ['formPatches.observationFacts', 'intakePatches.sensoryTriggers'];
      bridgeResult.summary.sensoryTriggersAdded = 2;
      bridgeResult.summary.icebergFieldsFilled = 1;
      
      bridgeResult.provenance = [
        {
          field: 'intakePatches.sensoryTriggers',
          source: 'tokusei_survey',
          sourceLabel: '特性アンケート',
          reason: 'テスト理由',
          value: '視覚過敏',
          confidence: 'high',
          importedAt: '2026-05-17T00:00:00Z',
        }
      ];

      const payload = buildTokuseiImportAuditPayload({
        planningSheetId: 'sheet-2',
        importedBy: 'Test User 2',
        tokuseiResponseId: 'tokusei-def',
        bridgeResult,
        now: '2026-05-17T00:00:01Z',
      });

      expect(payload.mode).toBe('with-tokusei');
      expect(payload.affectedFields).toEqual(['formPatches.observationFacts', 'intakePatches.sensoryTriggers']);
      expect(payload.summaryText).toBe('特性アンケート取込 (氷山分析: 1件 / 感覚トリガー: 2件)');
      
      // ProvenanceEntry に confidence は含まれないこと（型上 Omit されている想定、ランタイムでも含まれてよいが、一応形式を確認）
      expect(payload.provenance[0]).toEqual({
        field: 'intakePatches.sensoryTriggers',
        source: 'tokusei_survey',
        sourceLabel: '特性アンケート',
        reason: 'テスト理由',
        value: '視覚過敏',
        importedAt: '2026-05-17T00:00:00Z',
      });
    });
  });

  describe('hasAlreadyImportedTokusei', () => {
    it('should return true if the response id has already been imported', () => {
      const records: ImportAuditRecord[] = [
        {
          id: '1',
          planningSheetId: 'sheet-1',
          importedAt: '2026-05-17T00:00:00Z',
          importedBy: 'User',
          assessmentId: null,
          tokuseiResponseId: 'tokusei-xyz',
          mode: 'with-tokusei',
          affectedFields: [],
          provenance: [],
          summaryText: '',
        }
      ];

      expect(hasAlreadyImportedTokusei(records, 'tokusei-xyz')).toBe(true);
      expect(hasAlreadyImportedTokusei(records, 'tokusei-other')).toBe(false);
    });

    it('should ignore iceberg or other modes even with same id (conceptually)', () => {
      const records: ImportAuditRecord[] = [
        {
          id: '2',
          planningSheetId: 'sheet-1',
          importedAt: '2026-05-17T00:00:00Z',
          importedBy: 'User',
          assessmentId: null,
          tokuseiResponseId: 'tokusei-xyz', // Technically tokuseiResponseId is normally null for iceberg, but just in case
          mode: 'iceberg',
          affectedFields: [],
          provenance: [],
          summaryText: '',
        }
      ];

      expect(hasAlreadyImportedTokusei(records, 'tokusei-xyz')).toBe(false);
    });
  });
});
