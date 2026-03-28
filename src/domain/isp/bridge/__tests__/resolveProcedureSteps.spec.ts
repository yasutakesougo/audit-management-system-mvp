/**
 * resolveProcedureSteps + toProcedureRecord テスト
 *
 * Phase C: 手順の三段階優先解決
 * Phase D: 行動記録 → 制度実施記録の変換
 */
import { describe, expect, it } from 'vitest';
import type { PlanningDesign } from '@/domain/isp/schema';
import type { ProcedureStep } from '@/features/daily/domain/legacy/ProcedureRepository';
import type { ABCRecord } from '@/domain/behavior';
import {
  resolveProcedureSteps,
  type ProcedureResolutionInput,
} from '@/domain/isp/bridge/resolveProcedureSteps';
import {
  canConvertToRecord,
  deriveExecutionStatus,
  toProcedureRecord,
} from '@/domain/isp/bridge/toProcedureRecord';

// ─── helpers ───

function makeDesign(
  steps: Array<{ order: number; instruction: string; timing?: string }>,
): PlanningDesign {
  return {
    supportPriorities: [],
    antecedentStrategies: [],
    teachingStrategies: [],
    consequenceStrategies: [],
    procedureSteps: steps.map((s) => ({
      order: s.order,
      instruction: s.instruction,
      staff: '',
      timing: s.timing ?? '',
    })),
    crisisThresholds: null,
    restraintPolicy: 'prohibited_except_emergency',
    reviewCycleDays: 180,
  };
}

const baseSteps: ProcedureStep[] = [
  { id: 'base-1', time: '09:00', activity: '朝の受け入れ', instruction: '挨拶', isKey: true },
  { id: 'base-2', time: '12:00', activity: '昼食', instruction: '見守り', isKey: true },
];

const csvSteps: ProcedureStep[] = [
  { id: 'csv-1', time: '09:00', activity: 'CSV手順1', instruction: 'CSVからインポート', isKey: true, source: 'csv_import' },
  { id: 'csv-2', time: '10:00', activity: 'CSV手順2', instruction: 'CSVからインポート2', isKey: false, source: 'csv_import' },
];

function makeABCRecord(overrides: Partial<ABCRecord> = {}): ABCRecord {
  return {
    id: 'abc-001',
    userId: 'user-001',
    recordedAt: '2026-03-13T09:15:00Z',
    antecedent: '課題提示',
    antecedentTags: ['課題提示'],
    behavior: '離席',
    consequence: '声かけ',
    intensity: 2,
    ...overrides,
  };
}

// =====================
// Phase C: resolveProcedureSteps
// =====================

describe('resolveProcedureSteps', () => {
  it('resolves from planning_sheet when planningDesign has steps', () => {
    const design = makeDesign([
      { order: 1, instruction: '視線を合わせて挨拶。', timing: '09:00' },
      { order: 2, instruction: 'ロッカー整理。', timing: '09:15' },
    ]);
    const input: ProcedureResolutionInput = {
      planningDesign: design,
      planningSheetId: 'ps-001',
      storeSteps: baseSteps,
      hasStoreData: false,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('planning_sheet');
    expect(result.planningSheetId).toBe('ps-001');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].source).toBe('planning_sheet');
    expect(result.steps[0].planningSheetId).toBe('ps-001');
  });

  it('falls back to csv_import when planningDesign is null', () => {
    const input: ProcedureResolutionInput = {
      planningDesign: null,
      planningSheetId: null,
      storeSteps: csvSteps,
      hasStoreData: true,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('csv_import');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].source).toBe('csv_import');
  });

  it('falls back to csv_import when planningDesign has no steps', () => {
    const design = makeDesign([]);
    const input: ProcedureResolutionInput = {
      planningDesign: design,
      planningSheetId: 'ps-001',
      storeSteps: csvSteps,
      hasStoreData: true,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('csv_import');
  });

  it('falls back to base_steps when no store data and no planning design', () => {
    const input: ProcedureResolutionInput = {
      planningDesign: null,
      planningSheetId: null,
      storeSteps: baseSteps,
      hasStoreData: false,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('base_steps');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].source).toBe('base_steps');
  });

  it('returns empty steps when all sources are empty', () => {
    const input: ProcedureResolutionInput = {
      planningDesign: null,
      storeSteps: [],
      hasStoreData: false,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('base_steps');
    expect(result.steps).toHaveLength(0);
  });

  it('prefers planning_sheet over csv_import', () => {
    const design = makeDesign([
      { order: 1, instruction: 'シート由来の手順。', timing: '09:00' },
    ]);
    const input: ProcedureResolutionInput = {
      planningDesign: design,
      planningSheetId: 'ps-001',
      storeSteps: csvSteps,
      hasStoreData: true,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('planning_sheet');
    expect(result.steps[0].instruction).toBe('シート由来の手順。');
  });

  it('passes activityLabels to toDailyProcedureSteps', () => {
    const design = makeDesign([
      { order: 1, instruction: '長い手順テキスト。', timing: '09:00' },
    ]);
    const input: ProcedureResolutionInput = {
      planningDesign: design,
      planningSheetId: 'ps-001',
      activityLabels: { 1: '朝の受け入れ' },
    };

    const result = resolveProcedureSteps(input);
    expect(result.steps[0].activity).toBe('朝の受け入れ');
  });

  it('requires planningSheetId for planning_sheet resolution', () => {
    const design = makeDesign([
      { order: 1, instruction: '手順。', timing: '09:00' },
    ]);
    const input: ProcedureResolutionInput = {
      planningDesign: design,
      planningSheetId: null, // no ID
      storeSteps: baseSteps,
      hasStoreData: false,
    };

    const result = resolveProcedureSteps(input);
    expect(result.resolvedFrom).toBe('base_steps'); // cannot resolve from planning_sheet without ID
  });
});

// =====================
// Phase D: deriveExecutionStatus
// =====================

describe('deriveExecutionStatus', () => {
  it('returns done when actualObservation is present', () => {
    expect(deriveExecutionStatus(makeABCRecord({
      actualObservation: '特記事項なし。落ち着いて参加。',
    }))).toBe('done');
  });

  it('returns partially_done when only staffResponse', () => {
    expect(deriveExecutionStatus(makeABCRecord({
      staffResponse: '声かけを行った',
    }))).toBe('partially_done');
  });

  it('returns skipped when followUpNote contains 未実施', () => {
    expect(deriveExecutionStatus(makeABCRecord({
      followUpNote: '体調不良のため未実施',
    }))).toBe('skipped');
  });

  it('returns skipped when followUpNote contains スキップ', () => {
    expect(deriveExecutionStatus(makeABCRecord({
      followUpNote: '当日スキップ対応',
    }))).toBe('skipped');
  });

  it('returns planned when no observations', () => {
    expect(deriveExecutionStatus(makeABCRecord())).toBe('planned');
  });

  it('returns done even when staffResponse is also present', () => {
    expect(deriveExecutionStatus(makeABCRecord({
      actualObservation: '観察内容あり',
      staffResponse: '対応あり',
    }))).toBe('done');
  });
});

// =====================
// Phase D: toProcedureRecord
// =====================

describe('toProcedureRecord', () => {
  const planningStep: ProcedureStep = {
    id: 'ps-001-1',
    time: '09:00',
    activity: '朝の受け入れ',
    instruction: '視線を合わせて挨拶。体調チェックシート記入。',
    isKey: true,
    planningSheetId: 'ps-001',
    sourceStepOrder: 1,
    source: 'planning_sheet',
  };

  it('converts ABCRecord + ProcedureStep to ProcedureRecordInput', () => {
    const record = makeABCRecord({
      actualObservation: '落ち着いて参加',
      staffResponse: '声かけ実施',
      followUpNote: '継続する',
    });

    const result = toProcedureRecord(record, planningStep, 'staff-001');
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-001');
    expect(result!.planningSheetId).toBe('ps-001');
    expect(result!.recordDate).toBe('2026-03-13');
    expect(result!.timeSlot).toBe('09:00');
    expect(result!.activity).toBe('朝の受け入れ');
    expect(result!.procedureText).toBe('視線を合わせて挨拶。体調チェックシート記入。');
    expect(result!.executionStatus).toBe('done');
    expect(result!.userResponse).toBe('落ち着いて参加');
    expect(result!.specialNotes).toBe('声かけ実施');
    expect(result!.handoffNotes).toBe('継続する');
    expect(result!.performedBy).toBe('staff-001');
    expect(result!.sourceStepOrder).toBe(1);
  });

  it('returns null when step has no planningSheetId', () => {
    const stepWithoutSheet: ProcedureStep = {
      id: 'base-1',
      time: '09:00',
      activity: '朝の受け入れ',
      instruction: '挨拶',
      isKey: true,
    };

    const result = toProcedureRecord(makeABCRecord(), stepWithoutSheet, 'staff-001');
    expect(result).toBeNull();
  });

  it('allows executionStatus override', () => {
    const result = toProcedureRecord(
      makeABCRecord(),
      planningStep,
      'staff-001',
      { executionStatus: 'skipped' },
    );
    expect(result!.executionStatus).toBe('skipped');
  });

  it('allows ispId in options', () => {
    const result = toProcedureRecord(
      makeABCRecord(),
      planningStep,
      'staff-001',
      { ispId: 'isp-001' },
    );
    expect(result!.ispId).toBe('isp-001');
  });

  it('extracts date-only from ISO datetime', () => {
    const record = makeABCRecord({ recordedAt: '2026-03-13T23:59:59+09:00' });
    const result = toProcedureRecord(record, planningStep, 'staff-001');
    expect(result!.recordDate).toBe('2026-03-13');
  });

  it('defaults userResponse/specialNotes/handoffNotes to empty string', () => {
    const record = makeABCRecord();
    const result = toProcedureRecord(record, planningStep, 'staff-001');
    expect(result!.userResponse).toBe('');
    expect(result!.specialNotes).toBe('');
    expect(result!.handoffNotes).toBe('');
  });
});

// =====================
// Phase D: canConvertToRecord
// =====================

describe('canConvertToRecord', () => {
  it('returns true for planning_sheet steps with planningSheetId', () => {
    const step: ProcedureStep = {
      id: 'ps-1',
      time: '09:00',
      activity: 'test',
      instruction: 'test',
      isKey: true,
      planningSheetId: 'ps-001',
      source: 'planning_sheet',
    };
    expect(canConvertToRecord(step)).toBe(true);
  });

  it('returns false for base_steps', () => {
    const step: ProcedureStep = {
      id: 'base-1',
      time: '09:00',
      activity: 'test',
      instruction: 'test',
      isKey: true,
      source: 'base_steps',
    };
    expect(canConvertToRecord(step)).toBe(false);
  });

  it('returns false when planningSheetId is missing', () => {
    const step: ProcedureStep = {
      id: 'ps-1',
      time: '09:00',
      activity: 'test',
      instruction: 'test',
      isKey: true,
      source: 'planning_sheet',
    };
    expect(canConvertToRecord(step)).toBe(false);
  });

  it('returns false for csv_import', () => {
    const step: ProcedureStep = {
      id: 'csv-1',
      time: '09:00',
      activity: 'test',
      instruction: 'test',
      isKey: true,
      planningSheetId: 'ps-001',
      source: 'csv_import',
    };
    expect(canConvertToRecord(step)).toBe(false);
  });
});
