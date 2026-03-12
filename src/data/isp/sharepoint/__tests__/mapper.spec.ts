/**
 * ISP 三層モデル — Mapper ユニットテスト
 *
 * テスト観点:
 *   - SP row → domain の正常変換
 *   - null / undefined / 空文字の正規化
 *   - JSON 列（LongTermGoalsJson, ShortTermGoalsJson）のパース
 *   - create/update input → SP payload の変換
 *   - 部分更新で未指定フィールドが payload に含まれないこと
 */
import { describe, it, expect } from 'vitest';

import {
  // ISP
  mapIspRowToDomain,
  mapIspRowToListItem,
  mapIspCreateInputToPayload,
  mapIspUpdateInputToPayload,
  // Planning Sheet
  mapPlanningSheetRowToDomain,
  mapPlanningSheetRowToListItem,
  mapPlanningSheetCreateInputToPayload,
  mapPlanningSheetUpdateInputToPayload,
  // Procedure Record
  mapProcedureRecordRowToDomain,
  mapProcedureRecordRowToListItem,
  mapProcedureRecordCreateInputToPayload,
  mapProcedureRecordUpdateInputToPayload,
} from '../mapper';

import type { SpIspMasterRow } from '@/sharepoint/fields/ispThreeLayerFields';
import type { SpPlanningSheetRow } from '@/sharepoint/fields/ispThreeLayerFields';
import type { SpProcedureRecordRow } from '@/sharepoint/fields/ispThreeLayerFields';

// ─────────────────────────────────────────────
// テストデータファクトリ
// ─────────────────────────────────────────────

function makeSpIspRow(overrides: Partial<SpIspMasterRow> = {}): SpIspMasterRow {
  return {
    Id: 1,
    Title: 'U001_2026-04-01',
    UserCode: 'U001',
    PlanStartDate: '2026-04-01',
    PlanEndDate: '2027-03-31',
    UserIntent: '自分のペースで活動したい',
    FamilyIntent: '穏やかに過ごしてほしい',
    OverallSupportPolicy: '本人の意思を尊重',
    QolIssues: '',
    LongTermGoalsJson: '["コミュニケーション向上"]',
    ShortTermGoalsJson: '["PECSカードで要求を伝える"]',
    SupportSummary: '',
    Precautions: '',
    ConsentAt: '2026-04-05T10:00:00Z',
    DeliveredAt: '2026-04-06T10:00:00Z',
    MonitoringSummary: '',
    LastMonitoringAt: null,
    NextReviewAt: '2026-10-01',
    Status: 'active',
    VersionNo: 1,
    IsCurrent: true,
    FormDataJson: '{}',
    Created: '2026-04-01T09:00:00Z',
    Modified: '2026-04-01T09:00:00Z',
    ...overrides,
  };
}

function makeSpPlanningSheetRow(overrides: Partial<SpPlanningSheetRow> = {}): SpPlanningSheetRow {
  return {
    Id: 10,
    Title: 'U001_食事_v1',
    UserCode: 'U001',
    ISPLookupId: 1,
    ISPId: 'sp-1',
    TargetScene: '食事',
    TargetDomain: null,
    ObservationFacts: 'スプーンの持ち方が不安定',
    CollectedInformation: '',
    InterpretationHypothesis: '手指の筋力不足',
    SupportIssues: '食事の自立度向上',
    SupportPolicy: '段階的にスプーン使用を促す',
    EnvironmentalAdjustments: '',
    ConcreteApproaches: 'グリップ付きスプーンの提供',
    AppliedFrom: '2026-04-10',
    NextReviewAt: '2026-07-10',
    Status: 'active',
    VersionNo: 1,
    IsCurrent: true,
    FormDataJson: '{}',
    Created: '2026-04-10T09:00:00Z',
    Modified: '2026-04-10T09:00:00Z',
    ...overrides,
  };
}

function makeSpProcedureRecordRow(overrides: Partial<SpProcedureRecordRow> = {}): SpProcedureRecordRow {
  return {
    Id: 100,
    Title: 'U001_2026-05-01_12:00',
    UserCode: 'U001',
    ISPLookupId: 1,
    ISPId: 'sp-1',
    PlanningSheetLookupId: 10,
    PlanningSheetId: 'sp-10',
    RecordDate: '2026-05-01',
    TimeSlot: '12:00-12:30',
    Activity: '昼食',
    ProcedureText: 'グリップ付きスプーンを提供し声かけ',
    ExecutionStatus: 'done',
    UserResponse: '自力で食べた',
    SpecialNotes: null,
    HandoffNotes: null,
    PerformedBy: 'staff-A',
    PerformedAt: '2026-05-01T12:30:00Z',
    Created: '2026-05-01T13:00:00Z',
    Modified: '2026-05-01T13:00:00Z',
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// 第1層: ISP マッパー
// ═════════════════════════════════════════════

describe('ISP mapper', () => {
  describe('mapIspRowToDomain', () => {
    it('正常な SP row をドメインモデルに変換する', () => {
      const domain = mapIspRowToDomain(makeSpIspRow());

      expect(domain.id).toBe('sp-1');
      expect(domain.userId).toBe('U001');
      expect(domain.title).toBe('U001_2026-04-01');
      expect(domain.planStartDate).toBe('2026-04-01');
      expect(domain.planEndDate).toBe('2027-03-31');
      expect(domain.status).toBe('active');
      expect(domain.isCurrent).toBe(true);
      expect(domain.consentAt).toBe('2026-04-05T10:00:00Z');
    });

    it('JSON 列を配列にパースする', () => {
      const domain = mapIspRowToDomain(makeSpIspRow());

      expect(domain.longTermGoals).toEqual(['コミュニケーション向上']);
      expect(domain.shortTermGoals).toEqual(['PECSカードで要求を伝える']);
    });

    it('JSON 列が null のとき空配列にフォールバックする', () => {
      const domain = mapIspRowToDomain(makeSpIspRow({
        LongTermGoalsJson: null,
        ShortTermGoalsJson: null,
      }));

      expect(domain.longTermGoals).toEqual([]);
      expect(domain.shortTermGoals).toEqual([]);
    });

    it('JSON 列が不正な文字列のとき空配列にフォールバックする', () => {
      const domain = mapIspRowToDomain(makeSpIspRow({
        LongTermGoalsJson: 'これはJSONではない',
      }));

      expect(domain.longTermGoals).toEqual([]);
    });

    it('null フィールドをデフォルトに正規化する', () => {
      const domain = mapIspRowToDomain(makeSpIspRow({
        UserIntent: null,
        FamilyIntent: null,
        ConsentAt: null,
        NextReviewAt: null,
      }));

      expect(domain.userIntent).toBe('');
      expect(domain.familyIntent).toBe('');
      expect(domain.consentAt).toBeNull();
      expect(domain.nextReviewAt).toBeNull();
    });
  });

  describe('mapIspRowToListItem', () => {
    it('軽量一覧型に変換する', () => {
      const item = mapIspRowToListItem(makeSpIspRow());

      expect(item.id).toBe('sp-1');
      expect(item.userId).toBe('U001');
      expect(item.status).toBe('active');
      expect(item.isCurrent).toBe(true);
      // 一覧型にはフォーム内容が含まれない
      expect((item as Record<string, unknown>).userIntent).toBeUndefined();
    });
  });

  describe('mapIspCreateInputToPayload', () => {
    it('create input を SP payload に変換する', () => {
      const payload = mapIspCreateInputToPayload({
        userId: 'U002',
        title: '2026年度ISP',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        userIntent: 'テスト意向',
        familyIntent: '',
        overallSupportPolicy: 'テスト方針',
        qolIssues: '',
        longTermGoals: ['目標A', '目標B'],
        shortTermGoals: ['短期目標'],
        supportSummary: '',
        precautions: '',
        status: 'assessment',
      });

      expect(payload.UserCode).toBe('U002');
      expect(payload.PlanStartDate).toBe('2026-04-01');
      expect(payload.LongTermGoalsJson).toBe('["目標A","目標B"]');
      expect(payload.ShortTermGoalsJson).toBe('["短期目標"]');
      expect(payload.VersionNo).toBe(1);
      expect(payload.IsCurrent).toBe(true);
    });
  });

  describe('mapIspUpdateInputToPayload', () => {
    it('部分更新で指定フィールドのみ含まれる', () => {
      const payload = mapIspUpdateInputToPayload({
        status: 'monitoring',
        userIntent: '更新後の意向',
      });

      expect(payload.Status).toBe('monitoring');
      expect(payload.UserIntent).toBe('更新後の意向');
      // 未指定フィールドは含まれない
      expect(payload.PlanStartDate).toBeUndefined();
      expect(payload.LongTermGoalsJson).toBeUndefined();
    });

    it('longTermGoals を更新するとJSON化される', () => {
      const payload = mapIspUpdateInputToPayload({
        longTermGoals: ['新目標'],
      });

      expect(payload.LongTermGoalsJson).toBe('["新目標"]');
    });
  });
});

// ═════════════════════════════════════════════
// 第2層: 支援計画シート マッパー
// ═════════════════════════════════════════════

describe('PlanningSheet mapper', () => {
  describe('mapPlanningSheetRowToDomain', () => {
    it('正常な SP row をドメインモデルに変換する', () => {
      const domain = mapPlanningSheetRowToDomain(makeSpPlanningSheetRow());

      expect(domain.id).toBe('sp-10');
      expect(domain.userId).toBe('U001');
      expect(domain.ispId).toBe('sp-1');
      expect(domain.title).toBe('U001_食事_v1');
      expect(domain.targetScene).toBe('食事');
      expect(domain.status).toBe('active');
    });

    it('ISPId が null のとき ISPLookupId からフォールバックする', () => {
      const domain = mapPlanningSheetRowToDomain(makeSpPlanningSheetRow({
        ISPId: null,
        ISPLookupId: 42,
      }));

      expect(domain.ispId).toBe('sp-42');
    });

    it('null フィールドをデフォルトに正規化する', () => {
      const domain = mapPlanningSheetRowToDomain(makeSpPlanningSheetRow({
        TargetDomain: null,
        EnvironmentalAdjustments: null,
      }));

      expect(domain.targetDomain).toBe('');
      expect(domain.environmentalAdjustments).toBe('');
    });
  });

  describe('mapPlanningSheetRowToListItem', () => {
    it('軽量一覧型に変換する', () => {
      const item = mapPlanningSheetRowToListItem(makeSpPlanningSheetRow());

      expect(item.id).toBe('sp-10');
      expect(item.ispId).toBe('sp-1');
      expect(item.targetScene).toBe('食事');
    });
  });

  describe('mapPlanningSheetCreateInputToPayload', () => {
    it('create input を SP payload に変換する', () => {
      const payload = mapPlanningSheetCreateInputToPayload({
        userId: 'U001',
        ispId: 'sp-1',
        title: '食事場面',
        targetScene: '食事',
        targetDomain: '',
        observationFacts: '観察結果',
        collectedInformation: '',
        interpretationHypothesis: '仮説',
        supportIssues: '課題',
        supportPolicy: '方針',
        environmentalAdjustments: '',
        concreteApproaches: '具体策',
        authoredByStaffId: 'staff-1',
        authoredByQualification: 'practical_training',
        applicableServiceType: 'daily_life_care',
        applicableAddOnTypes: ['severe_disability_support'],
        hasMedicalCoordination: false,
        hasEducationCoordination: false,
        status: 'draft',
      });

      expect(payload.UserCode).toBe('U001');
      expect(payload.ISPId).toBe('sp-1');
      expect(payload.VersionNo).toBe(1);
      expect(payload.IsCurrent).toBe(true);
    });
  });

  describe('mapPlanningSheetUpdateInputToPayload', () => {
    it('部分更新で指定フィールドのみ含まれる', () => {
      const payload = mapPlanningSheetUpdateInputToPayload({
        status: 'active',
        observationFacts: '更新後の観察',
      });

      expect(payload.Status).toBe('active');
      expect(payload.ObservationFacts).toBe('更新後の観察');
      expect(payload.TargetScene).toBeUndefined();
    });
  });
});

// ═════════════════════════════════════════════
// 第3層: 支援手順記録 マッパー
// ═════════════════════════════════════════════

describe('ProcedureRecord mapper', () => {
  describe('mapProcedureRecordRowToDomain', () => {
    it('正常な SP row をドメインモデルに変換する', () => {
      const domain = mapProcedureRecordRowToDomain(makeSpProcedureRecordRow());

      expect(domain.id).toBe('sp-100');
      expect(domain.userId).toBe('U001');
      expect(domain.planningSheetId).toBe('sp-10');
      expect(domain.recordDate).toBe('2026-05-01');
      expect(domain.timeSlot).toBe('12:00-12:30');
      expect(domain.executionStatus).toBe('done');
    });

    it('PlanningSheetId が null のとき LookupId からフォールバックする', () => {
      const domain = mapProcedureRecordRowToDomain(makeSpProcedureRecordRow({
        PlanningSheetId: null,
        PlanningSheetLookupId: 99,
      }));

      expect(domain.planningSheetId).toBe('sp-99');
    });

    it('null フィールドを空文字に正規化する', () => {
      const domain = mapProcedureRecordRowToDomain(makeSpProcedureRecordRow({
        SpecialNotes: null,
        HandoffNotes: null,
        TimeSlot: null,
        Activity: null,
        UserResponse: null,
      }));

      expect(domain.specialNotes).toBe('');
      expect(domain.handoffNotes).toBe('');
      expect(domain.timeSlot).toBe('');
    });
  });

  describe('mapProcedureRecordRowToListItem', () => {
    it('軽量一覧型に変換する', () => {
      const item = mapProcedureRecordRowToListItem(makeSpProcedureRecordRow());

      expect(item.id).toBe('sp-100');
      expect(item.recordDate).toBe('2026-05-01');
      expect(item.executionStatus).toBe('done');
      expect(item.performedBy).toBe('staff-A');
    });
  });

  describe('mapProcedureRecordCreateInputToPayload', () => {
    it('create input を SP payload に変換する', () => {
      const payload = mapProcedureRecordCreateInputToPayload({
        userId: 'U001',
        planningSheetId: 'sp-10',
        recordDate: '2026-05-01',
        timeSlot: '12:00-12:30',
        activity: '昼食',
        procedureText: '手順テキスト',
        executionStatus: 'done',
        userResponse: '',
        specialNotes: '',
        handoffNotes: '',
        performedBy: 'staff-A',
        performedAt: '2026-05-01T12:30:00Z',
      });

      expect(payload.UserCode).toBe('U001');
      expect(payload.PlanningSheetId).toBe('sp-10');
      expect(payload.RecordDate).toBe('2026-05-01');
      expect(payload.ExecutionStatus).toBe('done');
    });
  });

  describe('mapProcedureRecordUpdateInputToPayload', () => {
    it('部分更新で指定フィールドのみ含まれる', () => {
      const payload = mapProcedureRecordUpdateInputToPayload({
        executionStatus: 'partially_done',
        userResponse: '途中まで食べた',
      });

      expect(payload.ExecutionStatus).toBe('partially_done');
      expect(payload.UserResponse).toBe('途中まで食べた');
      expect(payload.RecordDate).toBeUndefined();
      expect(payload.ProcedureText).toBeUndefined();
    });
  });
});
