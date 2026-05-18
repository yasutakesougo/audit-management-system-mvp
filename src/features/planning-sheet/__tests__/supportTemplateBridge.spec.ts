/**
 * supportTemplateBridge.spec — SupportTemplate ⇔ ProcedureStep 変換テスト
 */
import { describe, expect, it } from 'vitest';
import {
  csvRowToProcedureStep,
  csvRowsToProcedureSteps,
  scheduleItemToProcedureStep,
  scheduleItemsToProcedureSteps,
  procedureStepToScheduleItem,
  procedureStepsToScheduleItems,
  masterRowsToProcedureSteps,
} from '../bridge/supportTemplateBridge';
import type { SupportTemplateCsvRow } from '@/features/import/domain/csvImportTypes';
import type { ProcedureStep } from '@/domain/isp/schema';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';

describe('supportTemplateBridge', () => {
  // ── CSV → ProcedureStep ──

  describe('csvRowToProcedureStep', () => {
    it('maps CSV row to ProcedureStep with all fields', () => {
      const row: SupportTemplateCsvRow = {
        タイトル: 'テスト',
        UserCode: 'U-001',
        RowNo: '3',
        時間帯: '9:30〜10:30',
        活動内容: '朝の受け入れ',
        本人の動き: '荷物を置く',
        支援者の動き: '声掛けする',
      };

      const result = csvRowToProcedureStep(row, 0);

      expect(result).toEqual({
        order: 3,
        instruction: '朝の受け入れ（荷物を置く）',
        staff: '声掛けする',
        timing: '09:30',
      });
    });

    it('handles missing person manual', () => {
      const row: SupportTemplateCsvRow = {
        タイトル: 'テスト',
        UserCode: 'U-001',
        RowNo: '1',
        時間帯: '10:00',
        活動内容: '作業活動',
        本人の動き: '',
        支援者の動き: '見守り',
      };

      const result = csvRowToProcedureStep(row, 0);

      expect(result).toEqual({
        order: 1,
        instruction: '作業活動',
        staff: '見守り',
        timing: '10:00',
      });
    });

    it('returns null for rows without activity', () => {
      const row: SupportTemplateCsvRow = {
        タイトル: 'テスト',
        UserCode: 'U-001',
        RowNo: '1',
        時間帯: '10:00',
        活動内容: '',
        本人の動き: '',
        支援者の動き: '',
      };

      expect(csvRowToProcedureStep(row, 0)).toBeNull();
    });

    it('uses index + 1 when RowNo is invalid', () => {
      const row: SupportTemplateCsvRow = {
        タイトル: 'テスト',
        UserCode: 'U-001',
        RowNo: 'abc',
        時間帯: '10:00',
        活動内容: '活動',
        本人の動き: '',
        支援者の動き: '',
      };

      const result = csvRowToProcedureStep(row, 4);
      expect(result?.order).toBe(5);
    });
  });

  describe('csvRowsToProcedureSteps', () => {
    it('converts multiple rows, skips invalid, re-numbers', () => {
      const rows: SupportTemplateCsvRow[] = [
        { タイトル: 'T', UserCode: 'U-001', RowNo: '2', 時間帯: '10:00', 活動内容: '活動B', 本人の動き: '', 支援者の動き: '' },
        { タイトル: 'T', UserCode: 'U-001', RowNo: '1', 時間帯: '09:00', 活動内容: '活動A', 本人の動き: '', 支援者の動き: '' },
        { タイトル: 'T', UserCode: 'U-001', RowNo: '3', 時間帯: '', 活動内容: '', 本人の動き: '', 支援者の動き: '' }, // skip
      ];

      const result = csvRowsToProcedureSteps(rows);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ order: 1, instruction: '活動A' });
      expect(result[1]).toMatchObject({ order: 2, instruction: '活動B' });
    });
  });

  // ── ScheduleItem ⇔ ProcedureStep ──

  describe('scheduleItemToProcedureStep', () => {
    it('maps ScheduleItem to ProcedureStep', () => {
      const item: ScheduleItem = {
        id: 'test-1',
        time: '09:30',
        activity: '朝の会',
        instruction: '席に着く声掛け',
        isKey: true,
        linkedInterventionIds: ['bip-1'],
      };

      expect(scheduleItemToProcedureStep(item, 1)).toEqual({
        order: 1,
        instruction: '朝の会',
        staff: '席に着く声掛け',
        timing: '09:30',
      });
    });
  });

  describe('procedureStepToScheduleItem', () => {
    it('maps ProcedureStep to ScheduleItem', () => {
      const step: ProcedureStep = {
        order: 2,
        instruction: '作業活動',
        staff: '見守り',
        timing: '10:00',
      };

      const result = procedureStepToScheduleItem(step);

      expect(result).toEqual({
        id: 'ps-2',
        time: '10:00',
        activity: '作業活動',
        instruction: '見守り',
        isKey: false,
        linkedInterventionIds: [],
      });
    });
  });

  // ── Round-trip ──

  describe('round-trip conversion', () => {
    it('ScheduleItem → ProcedureStep → ScheduleItem preserves essential data', () => {
      const original: ScheduleItem[] = [
        { id: 'a', time: '09:00', activity: '朝の受け入れ', instruction: '声掛け', isKey: false },
        { id: 'b', time: '10:00', activity: '作業', instruction: '見守り', isKey: true },
      ];

      const steps = scheduleItemsToProcedureSteps(original);
      const restored = procedureStepsToScheduleItems(steps);

      expect(restored).toHaveLength(2);
      expect(restored[0].time).toBe('09:00');
      expect(restored[0].activity).toBe('朝の受け入れ');
      expect(restored[0].instruction).toBe('声掛け');
      expect(restored[1].time).toBe('10:00');
      expect(restored[1].activity).toBe('作業');
    });
  });

  // ── Master Rows → ProcedureStep ──

  describe('masterRowsToProcedureSteps', () => {
    it('converts static master data for user U-002 / I005 (Ishiwata-san)', () => {
      const steps = masterRowsToProcedureSteps('I005');
      expect(steps).toHaveLength(17);
      expect(steps[0]).toMatchObject({
        order: 1,
        instruction: '通所・朝の準備（送迎車で来所\n手洗い\n荷物の片づけ）',
        staff: '送迎担当と引継ぎ\nご本人と朝の準備（手洗い・荷物をロッカーへ）\nトイレ誘導・介助',
        timing: '9:30頃',
      });
    });

    it('returns default/empty steps when no specific master registered', () => {
      const steps = masterRowsToProcedureSteps('NON_EXISTENT_USER');
      expect(steps).toHaveLength(17);
      expect(steps[0]).toMatchObject({
        order: 1,
        instruction: '通所・朝の準備（手洗い、消毒、荷物をロッカーへ入れる）',
        staff: '通所時の様子を確認し、必要に応じて声かけ・見守りを行う',
        timing: '9:30頃',
      });
    });
  });
});
