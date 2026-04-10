/**
 * ISP 三層モデル — Zod スキーマ + ユーティリティのユニットテスト
 *
 * テスト方針:
 *   - 各層 × 4 スキーマ（Form / Domain / SpRow / ListItem）の正常系＋異常系
 *   - 必須項目欠落 → ZodError
 *   - enum/choice 値の検証
 *   - ISO 日付文字列の検証
 *   - SharePoint 行の null / undefined / 空文字の揺れ対応
 *   - 状態遷移ガードの検証
 *   - 見直し期限計算の検証
 */
import { describe, it, expect } from 'vitest';

import {
  // === ISP ===
  ispStatusSchema,
  ispFormSchema,
  individualSupportPlanSchema,
  ispSpRowSchema,
  ispListItemSchema,
  ISP_STATUS_DISPLAY,
  ISP_TRANSITIONS,
  isValidIspTransition,
  daysUntilIspReview,
  // === 支援計画シート ===
  planningSheetStatusSchema,
  planningSheetFormSchema,
  supportPlanningSheetSchema,
  planningSheetSpRowSchema,
  planningSheetListItemSchema,
  PLANNING_SHEET_STATUS_DISPLAY,
  // === 支援手順記録 ===
  procedureExecutionStatusSchema,
  procedureRecordFormSchema,
  supportProcedureRecordSchema,
  procedureRecordSpRowSchema,
  procedureRecordListItemSchema,
  EXECUTION_STATUS_DISPLAY,
  // === 制度モデル ===
  ISP_STATUS_LABELS,
  ISP_STATUS_TRANSITIONS,
  isValidISPTransition,
  isValidSupportPlanSheetTransition,
  // === 制度 enum ===
  staffQualificationSchema,
  STAFF_QUALIFICATION_DISPLAY,
  applicableServiceTypeSchema,
  SERVICE_TYPE_DISPLAY,
  applicableAddOnTypeSchema,
  ADD_ON_TYPE_DISPLAY,
  regulatoryBasisSnapshotSchema,
  // === 実務モデル ===
  planningIntakeSchema,
  planningAssessmentSchema,
  planningDesignSchema,
  draftBehaviorSchema,
  assessedBehaviorSchema,
  abcEventSchema,
  behaviorHypothesisSchema,
  riskLevelSchema,
  restraintPolicySchema,
  procedureStepSchema,
  // === A-1: ISP コンプライアンスメタデータ ===
  ispConsentDetailSchema,
  ispDeliveryDetailSchema,
  ispReviewControlSchema,
  ispComplianceMetadataSchema,
  ispMeetingDetailSchema,
  ispConsultationSupportSchema,
  isIspReviewOverdue,
  computeIspReviewOverdueDays,
  validateStandardServiceHours,
} from '@/domain/isp';

// ─────────────────────────────────────────────
// テストデータファクトリ
// ─────────────────────────────────────────────

const baseAudit = {
  id: 'test-001',
  createdAt: '2026-01-15T09:00:00Z',
  createdBy: 'user-a',
  updatedAt: '2026-01-15T09:00:00Z',
  updatedBy: 'user-a',
  version: 1,
};

function makeIspFormInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'U001',
    title: '2026年度 個別支援計画',
    planStartDate: '2026-04-01',
    planEndDate: '2027-03-31',
    userIntent: '自分のペースで活動に参加したい',
    familyIntent: '穏やかに過ごしてほしい',
    overallSupportPolicy: '本人の意思を最大限尊重した支援を行う',
    qolIssues: '',
    longTermGoals: ['コミュニケーションスキルの向上'],
    shortTermGoals: ['PECSカードで3つの要求を伝える'],
    supportSummary: '',
    precautions: '',
    status: 'assessment',
    ...overrides,
  };
}

function makeIspSpRow(overrides: Record<string, unknown> = {}) {
  return {
    Id: 42,
    Title: 'U001_2026',
    UserLookupId: 1,
    UserCode: 'U001',
    PlanStartDate: '2026-04-01',
    PlanEndDate: '2027-03-31',
    FormDataJson: '{}',
    Status: 'assessment',
    VersionNo: 1,
    IsCurrent: true,
    ConsentAt: null,
    DeliveredAt: null,
    LastMonitoringAt: null,
    NextReviewAt: null,
    Created: '2026-01-15T09:00:00Z',
    Modified: '2026-01-15T09:00:00Z',
    ...overrides,
  };
}

function makePlanningSheetFormInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'U001',
    ispId: 'isp-001',
    title: '食事場面の支援計画',
    targetScene: '食事',
    targetDomain: '',
    observationFacts: 'スプーンの持ち方が不安定',
    collectedInformation: '',
    interpretationHypothesis: '手指の筋力不足と視覚的フィードバックの欠如',
    supportIssues: '食事中の自立度向上',
    supportPolicy: '段階的にスプーン使用を促す',
    environmentalAdjustments: '',
    concreteApproaches: 'グリップ付きスプーンの提供と声かけ',
    status: 'draft',
    ...overrides,
  };
}

function makePlanningSheetSpRow(overrides: Record<string, unknown> = {}) {
  return {
    Id: 10,
    Title: 'U001_食事_v1',
    UserLookupId: 1,
    UserCode: 'U001',
    ISPLookupId: 42,
    ISPId: 'isp-001',
    TargetScene: '食事',
    TargetDomain: null,
    FormDataJson: '{}',
    Status: 'draft',
    VersionNo: 1,
    IsCurrent: true,
    AppliedFrom: null,
    NextReviewAt: null,
    Created: '2026-01-20T09:00:00Z',
    Modified: '2026-01-20T09:00:00Z',
    ...overrides,
  };
}

function makeProcedureRecordFormInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'U001',
    planningSheetId: 'ps-001',
    ispId: 'isp-001',
    recordDate: '2026-02-01',
    timeSlot: '12:00-12:30',
    activity: '昼食',
    procedureText: 'グリップ付きスプーンを提供し、食事中に3回声かけを行う',
    executionStatus: 'done',
    userResponse: '最後まで自力で食べることができた',
    specialNotes: '笑顔が多かった',
    handoffNotes: '',
    performedBy: 'staff-A',
    performedAt: '2026-02-01T12:30:00Z',
    ...overrides,
  };
}

function makeProcedureRecordSpRow(overrides: Record<string, unknown> = {}) {
  return {
    Id: 100,
    Title: 'U001_20260201_1200',
    UserLookupId: 1,
    UserCode: 'U001',
    ISPLookupId: 42,
    ISPId: 'isp-001',
    PlanningSheetLookupId: 10,
    PlanningSheetId: 'ps-001',
    RecordDate: '2026-02-01',
    TimeSlot: '12:00-12:30',
    Activity: '昼食',
    ProcedureText: 'グリップ付きスプーンを提供',
    ExecutionStatus: 'done',
    UserResponse: '自力で食べた',
    SpecialNotes: null,
    HandoffNotes: null,
    PerformedBy: 'staff-A',
    PerformedAt: '2026-02-01T12:30:00Z',
    Created: '2026-02-01T13:00:00Z',
    Modified: '2026-02-01T13:00:00Z',
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// 第1層: ISP（個別支援計画）
// ═════════════════════════════════════════════

describe('第1層: ISP', () => {
  // ── status enum ──

  describe('ispStatusSchema', () => {
    it.each([
      'assessment', 'proposal', 'meeting', 'consent_pending',
      'active', 'monitoring', 'revision', 'closed',
    ])('"%s" を受理する', (status) => {
      expect(ispStatusSchema.parse(status)).toBe(status);
    });

    it('不正な値を拒否する', () => {
      expect(() => ispStatusSchema.parse('invalid')).toThrow();
      expect(() => ispStatusSchema.parse('')).toThrow();
      expect(() => ispStatusSchema.parse(null)).toThrow();
    });
  });

  // ── ISP_STATUS_DISPLAY ──

  describe('ISP_STATUS_DISPLAY', () => {
    it('全ステータスに日本語ラベルが定義されている', () => {
      for (const status of ispStatusSchema.options) {
        expect(ISP_STATUS_DISPLAY[status]).toBeTruthy();
      }
    });
  });

  // ── フォームバリデーション ──

  describe('ispFormSchema', () => {
    it('正常な入力を受理する', () => {
      const input = makeIspFormInput();
      const result = ispFormSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('userId が空で失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ userId: '' }));
      expect(result.success).toBe(false);
    });

    it('title が空で失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ title: '' }));
      expect(result.success).toBe(false);
    });

    it('userIntent が空で失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ userIntent: '' }));
      expect(result.success).toBe(false);
    });

    it('overallSupportPolicy が空で失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ overallSupportPolicy: '' }));
      expect(result.success).toBe(false);
    });

    it('longTermGoals が空配列で失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ longTermGoals: [] }));
      expect(result.success).toBe(false);
    });

    it('shortTermGoals が空配列で失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ shortTermGoals: [] }));
      expect(result.success).toBe(false);
    });

    it('planStartDate が ISO 形式でないと失敗する', () => {
      const result = ispFormSchema.safeParse(makeIspFormInput({ planStartDate: '令和8年4月' }));
      expect(result.success).toBe(false);
    });

    it('status のデフォルトは assessment', () => {
      const input = makeIspFormInput();
      delete (input as Record<string, unknown>).status;
      const result = ispFormSchema.parse(input);
      expect(result.status).toBe('assessment');
    });
  });

  // ── ドメインモデル ──

  describe('individualSupportPlanSchema', () => {
    it('正常データを受理する', () => {
      const data = {
        ...baseAudit,
        userId: 'U001',
        title: '2026年度ISP',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        userIntent: '自分のペースで活動したい',
        overallSupportPolicy: '本人の意思尊重',
        longTermGoals: ['目標A'],
        shortTermGoals: ['目標B'],
        status: 'assessment',
        isCurrent: true,
      };
      const result = individualSupportPlanSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('オプション項目は省略可能', () => {
      const data = {
        ...baseAudit,
        userId: 'U001',
        title: '2026年度ISP',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        userIntent: 'テスト',
        overallSupportPolicy: 'テスト方針',
        longTermGoals: [],
        shortTermGoals: [],
        status: 'assessment',
      };
      const result = individualSupportPlanSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.consentAt).toBeNull();
        expect(result.data.deliveredAt).toBeNull();
        expect(result.data.isCurrent).toBe(true);
      }
    });
  });

  // ── SharePoint 行パース ──

  describe('ispSpRowSchema', () => {
    it('正常な SP 行を受理する', () => {
      const result = ispSpRowSchema.safeParse(makeIspSpRow());
      expect(result.success).toBe(true);
    });

    it('null フィールドをデフォルト値に補正する', () => {
      const row = makeIspSpRow({
        UserCode: null,
        PlanStartDate: null,
        ConsentAt: null,
        NextReviewAt: null,
      });
      const result = ispSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.UserCode).toBeNull();
        expect(result.data.ConsentAt).toBeNull();
      }
    });

    it('Status が未定義なら assessment にフォールバック', () => {
      const row = makeIspSpRow();
      delete (row as Record<string, unknown>).Status;
      const result = ispSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.Status).toBe('assessment');
      }
    });

    it('Created / Modified が省略可能', () => {
      const row = makeIspSpRow();
      delete (row as Record<string, unknown>).Created;
      delete (row as Record<string, unknown>).Modified;
      const result = ispSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it('Id が数値でないと失敗する', () => {
      const result = ispSpRowSchema.safeParse(makeIspSpRow({ Id: 'not-a-number' }));
      expect(result.success).toBe(false);
    });
  });

  // ── 一覧用型 ──

  describe('ispListItemSchema', () => {
    it('正常な一覧データを受理する', () => {
      const result = ispListItemSchema.safeParse({
        id: 'isp-001',
        userId: 'U001',
        title: '2026年度ISP',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        status: 'active',
        nextReviewAt: '2026-10-01',
        isCurrent: true,
      });
      expect(result.success).toBe(true);
    });

    it('nextReviewAt は null 許容', () => {
      const result = ispListItemSchema.safeParse({
        id: 'isp-001',
        userId: 'U001',
        title: 'テスト',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        status: 'assessment',
        nextReviewAt: null,
        isCurrent: false,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════
// 第2層: 支援計画シート
// ═════════════════════════════════════════════

describe('第2層: 支援計画シート', () => {
  describe('planningSheetStatusSchema', () => {
    it.each(['draft', 'review', 'active', 'revision_pending', 'archived'])(
      '"%s" を受理する', (status) => {
        expect(planningSheetStatusSchema.parse(status)).toBe(status);
      },
    );

    it('不正な値を拒否する', () => {
      expect(() => planningSheetStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('PLANNING_SHEET_STATUS_DISPLAY', () => {
    it('全ステータスに日本語ラベルが定義されている', () => {
      for (const status of planningSheetStatusSchema.options) {
        expect(PLANNING_SHEET_STATUS_DISPLAY[status]).toBeTruthy();
      }
    });
  });

  describe('planningSheetFormSchema', () => {
    it('正常な入力を受理する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput());
      expect(result.success).toBe(true);
    });

    it('ispId が空で失敗する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput({ ispId: '' }));
      expect(result.success).toBe(false);
    });

    it('observationFacts が空で失敗する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput({ observationFacts: '' }));
      expect(result.success).toBe(false);
    });

    it('interpretationHypothesis が空で失敗する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput({ interpretationHypothesis: '' }));
      expect(result.success).toBe(false);
    });

    it('supportIssues が空で失敗する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput({ supportIssues: '' }));
      expect(result.success).toBe(false);
    });

    it('supportPolicy が空で失敗する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput({ supportPolicy: '' }));
      expect(result.success).toBe(false);
    });

    it('concreteApproaches が空で失敗する', () => {
      const result = planningSheetFormSchema.safeParse(makePlanningSheetFormInput({ concreteApproaches: '' }));
      expect(result.success).toBe(false);
    });

    it('status のデフォルトは draft', () => {
      const input = makePlanningSheetFormInput();
      delete (input as Record<string, unknown>).status;
      const result = planningSheetFormSchema.parse(input);
      expect(result.status).toBe('draft');
    });
  });

  describe('supportPlanningSheetSchema', () => {
    it('正常データを受理する', () => {
      const data = {
        ...baseAudit,
        userId: 'U001',
        ispId: 'isp-001',
        title: '食事場面の支援計画',
        observationFacts: '行動観察結果',
        interpretationHypothesis: '仮説',
        supportIssues: '課題',
        supportPolicy: '方針',
        concreteApproaches: '具体策',
        status: 'draft',
      };
      const result = supportPlanningSheetSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isCurrent).toBe(true);
        expect(result.data.environmentalAdjustments).toBe('');
      }
    });
  });

  describe('planningSheetSpRowSchema', () => {
    it('正常な SP 行を受理する', () => {
      const result = planningSheetSpRowSchema.safeParse(makePlanningSheetSpRow());
      expect(result.success).toBe(true);
    });

    it('null フィールドをデフォルト値に補正する', () => {
      const row = makePlanningSheetSpRow({
        TargetDomain: null,
        ISPId: null,
        AppliedFrom: null,
        NextReviewAt: null,
      });
      const result = planningSheetSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.TargetDomain).toBeNull();
      }
    });

    it('Status が未定義なら draft にフォールバック', () => {
      const row = makePlanningSheetSpRow();
      delete (row as Record<string, unknown>).Status;
      const result = planningSheetSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.Status).toBe('draft');
      }
    });
  });

  describe('planningSheetListItemSchema', () => {
    it('正常な一覧データを受理する', () => {
      const result = planningSheetListItemSchema.safeParse({
        id: 'ps-001',
        userId: 'U001',
        ispId: 'isp-001',
        title: '食事場面',
        targetScene: '食事',
        status: 'active',
        nextReviewAt: null,
        isCurrent: true,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════
// 第2層: 制度項目テスト
// ═════════════════════════════════════════════

describe('制度項目 enum', () => {
  describe('staffQualificationSchema', () => {
    it.each([
      'practical_training', 'basic_training', 'behavior_guidance_training',
      'core_person_training', 'other', 'unknown',
    ])('"%s" を受理する', (q) => {
      expect(staffQualificationSchema.parse(q)).toBe(q);
    });

    it('不正な値を拒否する', () => {
      expect(() => staffQualificationSchema.parse('phd')).toThrow();
    });

    it('全値に日本語ラベルが定義されている', () => {
      for (const q of staffQualificationSchema.options) {
        expect(STAFF_QUALIFICATION_DISPLAY[q]).toBeTruthy();
      }
    });
  });

  describe('applicableServiceTypeSchema', () => {
    it.each([
      'daily_life_care', 'residential_support', 'short_stay',
      'group_home', 'behavior_support', 'home_care', 'other',
    ])('"%s" を受理する', (s) => {
      expect(applicableServiceTypeSchema.parse(s)).toBe(s);
    });

    it('全値に日本語ラベルが定義されている', () => {
      for (const s of applicableServiceTypeSchema.options) {
        expect(SERVICE_TYPE_DISPLAY[s]).toBeTruthy();
      }
    });
  });

  describe('applicableAddOnTypeSchema', () => {
    it.each([
      'severe_disability_support', 'behavior_support_coordination',
      'specialized_support', 'none',
    ])('"%s" を受理する', (a) => {
      expect(applicableAddOnTypeSchema.parse(a)).toBe(a);
    });

    it('全値に日本語ラベルが定義されている', () => {
      for (const a of applicableAddOnTypeSchema.options) {
        expect(ADD_ON_TYPE_DISPLAY[a]).toBeTruthy();
      }
    });
  });

  describe('regulatoryBasisSnapshotSchema', () => {
    it('完全なスナップショットを受理する', () => {
      const snapshot = {
        supportLevel: 4,
        behaviorScore: 18,
        serviceType: 'daily_life_care',
        eligibilityCheckedAt: '2026-03-01',
      };
      const result = regulatoryBasisSnapshotSchema.safeParse(snapshot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.supportLevel).toBe(4);
        expect(result.data.behaviorScore).toBe(18);
      }
    });

    it('空オブジェクトでデフォルト値を返す', () => {
      const result = regulatoryBasisSnapshotSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.supportLevel).toBeNull();
        expect(result.data.behaviorScore).toBeNull();
        expect(result.data.serviceType).toBeNull();
      }
    });

    it('undefined でデフォルト値を返す', () => {
      const result = regulatoryBasisSnapshotSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.supportLevel).toBeNull();
      }
    });
  });
});

describe('支援計画シート 制度項目統合', () => {
  describe('planningSheetFormSchema 制度デフォルト', () => {
    it('authoredByQualification のデフォルトは unknown', () => {
      const input = makePlanningSheetFormInput();
      const result = planningSheetFormSchema.parse(input);
      expect(result.authoredByQualification).toBe('unknown');
    });

    it('applicableServiceType のデフォルトは other', () => {
      const input = makePlanningSheetFormInput();
      const result = planningSheetFormSchema.parse(input);
      expect(result.applicableServiceType).toBe('other');
    });

    it('applicableAddOnTypes のデフォルトは ["none"]', () => {
      const input = makePlanningSheetFormInput();
      const result = planningSheetFormSchema.parse(input);
      expect(result.applicableAddOnTypes).toEqual(['none']);
    });

    it('hasMedicalCoordination のデフォルトは false', () => {
      const input = makePlanningSheetFormInput();
      const result = planningSheetFormSchema.parse(input);
      expect(result.hasMedicalCoordination).toBe(false);
    });
  });

  describe('supportPlanningSheetSchema 制度デフォルト', () => {
    it('制度項目がデフォルト値で埋まる', () => {
      const data = {
        ...baseAudit,
        userId: 'U001',
        ispId: 'isp-001',
        title: 'テスト',
        observationFacts: 'x',
        interpretationHypothesis: 'x',
        supportIssues: 'x',
        supportPolicy: 'x',
        concreteApproaches: 'x',
        status: 'draft',
      };
      const result = supportPlanningSheetSchema.parse(data);
      expect(result.authoredByStaffId).toBe('');
      expect(result.authoredByQualification).toBe('unknown');
      expect(result.applicableServiceType).toBe('other');
      expect(result.applicableAddOnTypes).toEqual(['none']);
      expect(result.deliveredToUserAt).toBeNull();
      expect(result.reviewedAt).toBeNull();
      expect(result.hasMedicalCoordination).toBe(false);
      expect(result.hasEducationCoordination).toBe(false);
      expect(result.regulatoryBasisSnapshot).toEqual({
        supportLevel: null,
        behaviorScore: null,
        serviceType: null,
        eligibilityCheckedAt: null,
      });
    });

    it('制度項目を明示できる', () => {
      const data = {
        ...baseAudit,
        userId: 'U001',
        ispId: 'isp-001',
        title: 'テスト',
        observationFacts: 'x',
        interpretationHypothesis: 'x',
        supportIssues: 'x',
        supportPolicy: 'x',
        concreteApproaches: 'x',
        status: 'active',
        authoredByStaffId: 'staff-1',
        authoredByQualification: 'practical_training',
        authoredAt: '2026-03-01',
        applicableServiceType: 'daily_life_care',
        applicableAddOnTypes: ['severe_disability_support'],
        deliveredToUserAt: '2026-03-05',
        reviewedAt: '2026-03-10',
        hasMedicalCoordination: true,
        hasEducationCoordination: false,
        regulatoryBasisSnapshot: {
          supportLevel: 4,
          behaviorScore: 18,
          serviceType: 'daily_life_care',
          eligibilityCheckedAt: '2026-02-15',
        },
      };
      const result = supportPlanningSheetSchema.parse(data);
      expect(result.authoredByQualification).toBe('practical_training');
      expect(result.applicableAddOnTypes).toEqual(['severe_disability_support']);
      expect(result.regulatoryBasisSnapshot.supportLevel).toBe(4);
      expect(result.hasMedicalCoordination).toBe(true);
    });
  });

  describe('planningSheetSpRowSchema 制度フィールド', () => {
    it('制度フィールドが省略可能（null デフォルト）', () => {
      const row = makePlanningSheetSpRow();
      const result = planningSheetSpRowSchema.parse(row);
      expect(result.AuthoredByStaffId).toBeNull();
      expect(result.AuthoredByQualification).toBeNull();
      expect(result.ApplicableAddOnTypesJson).toBeNull();
      expect(result.HasMedicalCoordination).toBeNull();
      expect(result.RegulatoryBasisSnapshotJson).toBeNull();
    });

    it('制度フィールドを明示できる', () => {
      const row = makePlanningSheetSpRow({
        AuthoredByStaffId: 'staff-1',
        AuthoredByQualification: 'practical_training',
        ApplicableAddOnTypesJson: '["severe_disability_support"]',
        HasMedicalCoordination: true,
        RegulatoryBasisSnapshotJson: '{"supportLevel":4}',
      });
      const result = planningSheetSpRowSchema.parse(row);
      expect(result.AuthoredByStaffId).toBe('staff-1');
      expect(result.HasMedicalCoordination).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════
// 第3層: 支援手順書兼記録
// ═════════════════════════════════════════════

describe('第3層: 支援手順書兼記録', () => {
  describe('procedureExecutionStatusSchema', () => {
    it.each(['planned', 'done', 'skipped', 'partially_done'])(
      '"%s" を受理する', (status) => {
        expect(procedureExecutionStatusSchema.parse(status)).toBe(status);
      },
    );

    it('不正な値を拒否する', () => {
      expect(() => procedureExecutionStatusSchema.parse('completed')).toThrow();
    });
  });

  describe('EXECUTION_STATUS_DISPLAY', () => {
    it('全ステータスに日本語ラベルが定義されている', () => {
      for (const status of procedureExecutionStatusSchema.options) {
        expect(EXECUTION_STATUS_DISPLAY[status]).toBeTruthy();
      }
    });
  });

  describe('procedureRecordFormSchema', () => {
    it('正常な入力を受理する', () => {
      const result = procedureRecordFormSchema.safeParse(makeProcedureRecordFormInput());
      expect(result.success).toBe(true);
    });

    it('userId が空で失敗する', () => {
      const result = procedureRecordFormSchema.safeParse(makeProcedureRecordFormInput({ userId: '' }));
      expect(result.success).toBe(false);
    });

    it('planningSheetId が空で失敗する', () => {
      const result = procedureRecordFormSchema.safeParse(makeProcedureRecordFormInput({ planningSheetId: '' }));
      expect(result.success).toBe(false);
    });

    it('procedureText が空で失敗する', () => {
      const result = procedureRecordFormSchema.safeParse(makeProcedureRecordFormInput({ procedureText: '' }));
      expect(result.success).toBe(false);
    });

    it('performedBy が空で失敗する', () => {
      const result = procedureRecordFormSchema.safeParse(makeProcedureRecordFormInput({ performedBy: '' }));
      expect(result.success).toBe(false);
    });

    it('recordDate が ISO 形式でないと失敗する', () => {
      const result = procedureRecordFormSchema.safeParse(makeProcedureRecordFormInput({ recordDate: '2/1' }));
      expect(result.success).toBe(false);
    });

    it('executionStatus のデフォルトは planned', () => {
      const input = makeProcedureRecordFormInput();
      delete (input as Record<string, unknown>).executionStatus;
      const result = procedureRecordFormSchema.parse(input);
      expect(result.executionStatus).toBe('planned');
    });
  });

  describe('supportProcedureRecordSchema', () => {
    it('正常データを受理する', () => {
      const data = {
        ...baseAudit,
        userId: 'U001',
        planningSheetId: 'ps-001',
        recordDate: '2026-02-01',
        procedureText: '手順テキスト',
        executionStatus: 'done',
        performedBy: 'staff-A',
        performedAt: '2026-02-01T12:00:00Z',
      };
      const result = supportProcedureRecordSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ispId).toBeNull();
        expect(result.data.timeSlot).toBe('');
        expect(result.data.specialNotes).toBe('');
      }
    });
  });

  describe('procedureRecordSpRowSchema', () => {
    it('正常な SP 行を受理する', () => {
      const result = procedureRecordSpRowSchema.safeParse(makeProcedureRecordSpRow());
      expect(result.success).toBe(true);
    });

    it('null フィールドをデフォルト値に補正する', () => {
      const row = makeProcedureRecordSpRow({
        ISPId: null,
        SpecialNotes: null,
        HandoffNotes: null,
        TimeSlot: null,
        Activity: null,
        UserResponse: null,
      });
      const result = procedureRecordSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SpecialNotes).toBeNull();
        expect(result.data.HandoffNotes).toBeNull();
      }
    });

    it('ExecutionStatus が未定義なら planned にフォールバック', () => {
      const row = makeProcedureRecordSpRow();
      delete (row as Record<string, unknown>).ExecutionStatus;
      const result = procedureRecordSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ExecutionStatus).toBe('planned');
      }
    });

    it('Created / Modified が省略可能', () => {
      const row = makeProcedureRecordSpRow();
      delete (row as Record<string, unknown>).Created;
      delete (row as Record<string, unknown>).Modified;
      const result = procedureRecordSpRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });
  });

  describe('procedureRecordListItemSchema', () => {
    it('正常な一覧データを受理する', () => {
      const result = procedureRecordListItemSchema.safeParse({
        id: 'rec-001',
        userId: 'U001',
        planningSheetId: 'ps-001',
        recordDate: '2026-02-01',
        timeSlot: '12:00-12:30',
        activity: '昼食',
        executionStatus: 'done',
        performedBy: 'staff-A',
      });
      expect(result.success).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════
// ユーティリティ関数
// ═════════════════════════════════════════════

describe('ユーティリティ', () => {
  // ── schema.ts のユーティリティ ──

  describe('isValidIspTransition (schema)', () => {
    it('assessment → proposal は許可', () => {
      expect(isValidIspTransition('assessment', 'proposal')).toBe(true);
    });

    it('assessment → active は不許可', () => {
      expect(isValidIspTransition('assessment', 'active')).toBe(false);
    });

    it('monitoring → revision は許可', () => {
      expect(isValidIspTransition('monitoring', 'revision')).toBe(true);
    });

    it('monitoring → closed は許可', () => {
      expect(isValidIspTransition('monitoring', 'closed')).toBe(true);
    });

    it('closed からの遷移はすべて不許可', () => {
      expect(isValidIspTransition('closed', 'assessment')).toBe(false);
      expect(isValidIspTransition('closed', 'proposal')).toBe(false);
    });

    it('revision → proposal は許可（見直し→再提案）', () => {
      expect(isValidIspTransition('revision', 'proposal')).toBe(true);
    });
  });

  describe('daysUntilIspReview', () => {
    it('次回見直しまでの残日数を計算する', () => {
      const days = daysUntilIspReview('2026-03-20', '2026-03-12');
      expect(days).toBe(8);
    });

    it('期限超過は負の値を返す', () => {
      const days = daysUntilIspReview('2026-03-10', '2026-03-12');
      expect(days).toBe(-2);
    });

    it('null の場合は null を返す', () => {
      expect(daysUntilIspReview(null)).toBeNull();
    });

    it('同日は 0 を返す', () => {
      expect(daysUntilIspReview('2026-03-12', '2026-03-12')).toBe(0);
    });
  });

  // ── types.ts のユーティリティ（制度モデル） ──

  describe('isValidISPTransition (制度モデル)', () => {
    it('assessment → draft_creation は許可', () => {
      expect(isValidISPTransition('assessment', 'draft_creation')).toBe(true);
    });

    it('assessment → meeting は不許可', () => {
      expect(isValidISPTransition('assessment', 'meeting')).toBe(false);
    });

    it('review → draft_creation は許可（見直し→再作成）', () => {
      expect(isValidISPTransition('review', 'draft_creation')).toBe(true);
    });
  });

  describe('isValidSupportPlanSheetTransition (制度モデル)', () => {
    it('behavior_assessment → hypothesis_organization は許可', () => {
      expect(isValidSupportPlanSheetTransition('behavior_assessment', 'hypothesis_organization')).toBe(true);
    });

    it('behavior_assessment → plan_creation は不許可', () => {
      expect(isValidSupportPlanSheetTransition('behavior_assessment', 'plan_creation')).toBe(false);
    });

    it('revision → plan_creation は許可（改訂→再計画）', () => {
      expect(isValidSupportPlanSheetTransition('revision', 'plan_creation')).toBe(true);
    });
  });

  // ── 定数の整合性 ──

  describe('ISP_STATUS_LABELS (制度モデル)', () => {
    it('全ステータスにラベルが定義されている', () => {
      const statuses = Object.keys(ISP_STATUS_TRANSITIONS);
      for (const s of statuses) {
        expect(ISP_STATUS_LABELS[s as keyof typeof ISP_STATUS_LABELS]).toBeTruthy();
      }
    });
  });

  describe('ISP_TRANSITIONS (schema)', () => {
    it('全ステータスの遷移先が定義されている', () => {
      for (const status of ispStatusSchema.options) {
        expect(ISP_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(ISP_TRANSITIONS[status])).toBe(true);
      }
    });

    it('遷移先はすべて有効なステータス値', () => {
      const validStatuses = new Set(ispStatusSchema.options);
      for (const targets of Object.values(ISP_TRANSITIONS)) {
        for (const t of targets) {
          expect(validStatuses.has(t)).toBe(true);
        }
      }
    });
  });
});

// ═════════════════════════════════════════════
// 実務モデル: インテーク / アセスメント / プランニング
// ═════════════════════════════════════════════

describe('実務モデル: インテーク', () => {
  describe('draftBehaviorSchema', () => {
    it('正常な対象行動下書きを受理する', () => {
      const result = draftBehaviorSchema.safeParse({ name: '自傷', description: '頭を壁に打ちつける', frequency: '1日平圈5回' });
      expect(result.success).toBe(true);
    });

    it('name が空で失敗する', () => {
      const result = draftBehaviorSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('planningIntakeSchema', () => {
    it('undefined で全デフォルト値を返す', () => {
      const result = planningIntakeSchema.parse(undefined);
      expect(result.presentingProblem).toBe('');
      expect(result.targetBehaviorsDraft).toEqual([]);
      expect(result.behaviorItemsTotal).toBeNull();
      expect(result.communicationModes).toEqual([]);
      expect(result.sensoryTriggers).toEqual([]);
      expect(result.medicalFlags).toEqual([]);
    });

    it('完全なインテークを受理する', () => {
      const result = planningIntakeSchema.safeParse({
        presentingProblem: '自傷行為が頻繁',
        targetBehaviorsDraft: [{ name: '自傷', description: '頭打ち', frequency: '5回/日' }],
        behaviorItemsTotal: 14,
        incidentSummaryLast30d: 'インシデント3件',
        communicationModes: ['PECS', 'ジェスチャー'],
        sensoryTriggers: ['大きな音', '人混み'],
        medicalFlags: ['てんかん既往'],
        consentScope: ['行動観察', 'ビデオ撮影'],
        consentDate: '2026-03-01',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.behaviorItemsTotal).toBe(14);
        expect(result.data.targetBehaviorsDraft).toHaveLength(1);
      }
    });

    it('behaviorItemsTotal が 0〜24 の範囲外で失敗する', () => {
      expect(planningIntakeSchema.safeParse({ behaviorItemsTotal: -1 }).success).toBe(false);
      expect(planningIntakeSchema.safeParse({ behaviorItemsTotal: 25 }).success).toBe(false);
    });

    it('behaviorItemsTotal が境界値で受理される', () => {
      expect(planningIntakeSchema.safeParse({ behaviorItemsTotal: 0 }).success).toBe(true);
      expect(planningIntakeSchema.safeParse({ behaviorItemsTotal: 24 }).success).toBe(true);
    });
  });
});

describe('実務モデル: アセスメント', () => {
  describe('assessedBehaviorSchema', () => {
    it('操作的定義を含む対象行動を受理する', () => {
      const result = assessedBehaviorSchema.safeParse({
        name: '自傷',
        operationalDefinition: '拳で頭部を打つ行動。5秒以内に2回以上',
        frequency: '1日平圈5回',
        intensity: '強（紅斑が残る）',
        duration: '1エピソード平埧30秒',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('abcEventSchema', () => {
    it('ABC 観察イベントを受理する', () => {
      const result = abcEventSchema.safeParse({
        antecedent: '活動の切り替え時',
        behavior: '頭を壁に打ちつける',
        consequence: '職員が声かけ・抜去',
        date: '2026-02-15',
        notes: '後半の活動開始前に発生',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('behaviorHypothesisSchema', () => {
    it('機能仮説を受理する', () => {
      const result = behaviorHypothesisSchema.safeParse({
        function: '回避（活動切り替えの不安からの回避）',
        evidence: 'ABC観察で先行事象の80%が切り替え場面',
        confidence: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('confidence のデフォルトは low', () => {
      const result = behaviorHypothesisSchema.parse({});
      expect(result.confidence).toBe('low');
    });
  });

  describe('riskLevelSchema', () => {
    it.each(['low', 'medium', 'high'])('"%s" を受理する', (level) => {
      expect(riskLevelSchema.parse(level)).toBe(level);
    });

    it('不正な値を拒否する', () => {
      expect(() => riskLevelSchema.parse('critical')).toThrow();
    });
  });

  describe('planningAssessmentSchema', () => {
    it('undefined で全デフォルト値を返す', () => {
      const result = planningAssessmentSchema.parse(undefined);
      expect(result.targetBehaviors).toEqual([]);
      expect(result.abcEvents).toEqual([]);
      expect(result.hypotheses).toEqual([]);
      expect(result.riskLevel).toBe('low');
      expect(result.healthFactors).toEqual([]);
      expect(result.teamConsensusNote).toBe('');
    });

    it('完全なアセスメントを受理する', () => {
      const result = planningAssessmentSchema.safeParse({
        targetBehaviors: [{ name: '自傷', operationalDefinition: '定義' }],
        abcEvents: [{ antecedent: 'A', behavior: 'B', consequence: 'C' }],
        hypotheses: [{ function: '回避', evidence: '観察', confidence: 'medium' }],
        riskLevel: 'high',
        healthFactors: ['てんかん'],
        teamConsensusNote: 'チーム合意済み',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.riskLevel).toBe('high');
        expect(result.data.targetBehaviors).toHaveLength(1);
      }
    });
  });
});

describe('実務モデル: プランニング', () => {
  describe('procedureStepSchema', () => {
    it('正常な手順ステップを受理する', () => {
      const result = procedureStepSchema.safeParse({
        order: 1,
        instruction: 'グリップ付きスプーンを提供',
        staff: '担当A',
        timing: '食事開始前',
      });
      expect(result.success).toBe(true);
    });

    it('order が 0 で失敗する', () => {
      const result = procedureStepSchema.safeParse({ order: 0, instruction: 'x' });
      expect(result.success).toBe(false);
    });

    it('instruction が空で失敗する', () => {
      const result = procedureStepSchema.safeParse({ order: 1, instruction: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('restraintPolicySchema', () => {
    it('prohibited_except_emergency を受理する', () => {
      expect(restraintPolicySchema.parse('prohibited_except_emergency')).toBe('prohibited_except_emergency');
    });

    it('not_applicable を受理する', () => {
      expect(restraintPolicySchema.parse('not_applicable')).toBe('not_applicable');
    });

    it('不正な値を拒否する（allowed 等）', () => {
      expect(() => restraintPolicySchema.parse('allowed')).toThrow();
      expect(() => restraintPolicySchema.parse('sometimes')).toThrow();
    });
  });

  describe('planningDesignSchema', () => {
    it('undefined で全デフォルト値を返す', () => {
      const result = planningDesignSchema.parse(undefined);
      expect(result.supportPriorities).toEqual([]);
      expect(result.antecedentStrategies).toEqual([]);
      expect(result.teachingStrategies).toEqual([]);
      expect(result.consequenceStrategies).toEqual([]);
      expect(result.procedureSteps).toEqual([]);
      expect(result.crisisThresholds).toBeNull();
      expect(result.restraintPolicy).toBe('prohibited_except_emergency');
      expect(result.reviewCycleDays).toBe(180);
    });

    it('完全なプランニングを受理する', () => {
      const result = planningDesignSchema.safeParse({
        supportPriorities: ['自傷予防', 'コミュニケーション向上'],
        antecedentStrategies: ['切り替え前の予告', 'タイマー提示'],
        teachingStrategies: ['PECSカードの対応拡大'],
        consequenceStrategies: ['適切な要求への応答強化'],
        procedureSteps: [
          { order: 1, instruction: '切り替え5分前に予告', staff: '担当A', timing: '切り替え前' },
          { order: 2, instruction: 'タイマー提示', staff: '担当A', timing: '切り替え時' },
        ],
        crisisThresholds: {
          escalationLevel: 'レベル3：30秒以上連続',
          deescalationSteps: ['安全な場所へ誘導', 'クールダウンスペース提供'],
          emergencyContacts: ['管理者電話: 090-xxxx'],
        },
        restraintPolicy: 'prohibited_except_emergency',
        reviewCycleDays: 90,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.procedureSteps).toHaveLength(2);
        expect(result.data.crisisThresholds?.escalationLevel).toContain('レベル3');
        expect(result.data.reviewCycleDays).toBe(90);
      }
    });

    it('reviewCycleDays が 0 で失敗する', () => {
      const result = planningDesignSchema.safeParse({ reviewCycleDays: 0 });
      expect(result.success).toBe(false);
    });
  });
});

describe('実務モデル: ドメインモデル統合', () => {
  it('supportPlanningSheetSchema に実務モデルがデフォルトで含まれる', () => {
    const data = {
      ...baseAudit,
      userId: 'U001',
      ispId: 'isp-001',
      title: 'テスト',
      observationFacts: 'x',
      interpretationHypothesis: 'x',
      supportIssues: 'x',
      supportPolicy: 'x',
      concreteApproaches: 'x',
      status: 'draft',
    };
    const result = supportPlanningSheetSchema.parse(data);

    // intake デフォルト
    expect(result.intake.presentingProblem).toBe('');
    expect(result.intake.targetBehaviorsDraft).toEqual([]);
    expect(result.intake.behaviorItemsTotal).toBeNull();

    // assessment デフォルト
    expect(result.assessment.targetBehaviors).toEqual([]);
    expect(result.assessment.riskLevel).toBe('low');

    // planning デフォルト
    expect(result.planning.supportPriorities).toEqual([]);
    expect(result.planning.restraintPolicy).toBe('prohibited_except_emergency');
    expect(result.planning.reviewCycleDays).toBe(180);
  });

  it('supportPlanningSheetSchema に実務モデルを明示できる', () => {
    const data = {
      ...baseAudit,
      userId: 'U001',
      ispId: 'isp-001',
      title: 'テスト',
      observationFacts: 'x',
      interpretationHypothesis: 'x',
      supportIssues: 'x',
      supportPolicy: 'x',
      concreteApproaches: 'x',
      status: 'active',
      intake: {
        presentingProblem: '自傷が頻繁',
        targetBehaviorsDraft: [{ name: '自傷' }],
        behaviorItemsTotal: 14,
      },
      assessment: {
        targetBehaviors: [{ name: '自傷', operationalDefinition: '定義' }],
        riskLevel: 'high',
      },
      planning: {
        supportPriorities: ['自傷予防'],
        restraintPolicy: 'prohibited_except_emergency',
        reviewCycleDays: 90,
      },
    };
    const result = supportPlanningSheetSchema.parse(data);
    expect(result.intake.behaviorItemsTotal).toBe(14);
    expect(result.assessment.riskLevel).toBe('high');
    expect(result.planning.reviewCycleDays).toBe(90);
  });

  it('planningSheetSpRowSchema の JSON 列が省略可能', () => {
    const row = makePlanningSheetSpRow();
    const result = planningSheetSpRowSchema.parse(row);
    expect(result.IntakeJson).toBeNull();
    expect(result.AssessmentJson).toBeNull();
    expect(result.PlanningJson).toBeNull();
  });
});

// ─────────────────────────────────────────────
// A-1: ISP コンプライアンスメタデータ
// ─────────────────────────────────────────────

describe('ISP コンプライアンスメタデータ (A-1)', () => {
  // ── サブスキーマのデフォルト値 ──

  describe('ispConsentDetailSchema', () => {
    it('空オブジェクトからデフォルトが生成される', () => {
      const result = ispConsentDetailSchema.parse(undefined);
      expect(result).toEqual({
        explainedAt: null,
        explainedBy: '',
        consentedAt: null,
        consentedBy: '',
        proxyName: '',
        proxyRelation: '',
        notes: '',
      });
    });

    it('部分的な入力でもデフォルト補完される', () => {
      const result = ispConsentDetailSchema.parse({
        explainedAt: '2026-04-01T10:00:00Z',
        consentedBy: '田中太郎',
      });
      expect(result.explainedAt).toBe('2026-04-01T10:00:00Z');
      expect(result.consentedBy).toBe('田中太郎');
      expect(result.proxyName).toBe('');
    });
  });

  describe('ispDeliveryDetailSchema', () => {
    it('空オブジェクトからデフォルトが生成される', () => {
      const result = ispDeliveryDetailSchema.parse(undefined);
      expect(result).toEqual({
        deliveredAt: null,
        deliveredToUser: false,
        deliveredToConsultationSupport: false,
        deliveryMethod: '',
        notes: '',
      });
    });

    it('交付情報を設定できる', () => {
      const result = ispDeliveryDetailSchema.parse({
        deliveredAt: '2026-04-05T10:00:00Z',
        deliveredToUser: true,
        deliveredToConsultationSupport: true,
        deliveryMethod: '手渡し',
      });
      expect(result.deliveredToUser).toBe(true);
      expect(result.deliveredToConsultationSupport).toBe(true);
      expect(result.deliveryMethod).toBe('手渡し');
    });
  });

  describe('ispReviewControlSchema', () => {
    it('空オブジェクトからデフォルト（180日）が生成される', () => {
      const result = ispReviewControlSchema.parse(undefined);
      expect(result.reviewCycleDays).toBe(180);
      expect(result.lastReviewedAt).toBeNull();
      expect(result.nextReviewDueAt).toBeNull();
      expect(result.reviewReason).toBe('');
    });

    it('見直し周期を変更できる', () => {
      const result = ispReviewControlSchema.parse({
        reviewCycleDays: 90,
        lastReviewedAt: '2026-01-01',
        nextReviewDueAt: '2026-04-01',
        reviewReason: '行動上の課題が顕著',
      });
      expect(result.reviewCycleDays).toBe(90);
      expect(result.reviewReason).toBe('行動上の課題が顕著');
    });

    it('reviewCycleDays が 0 以下の場合エラー', () => {
      expect(() => ispReviewControlSchema.parse({ reviewCycleDays: 0 })).toThrow();
    });
  });

  describe('ispComplianceMetadataSchema', () => {
    it('undefinedからフルデフォルトが生成される', () => {
      const result = ispComplianceMetadataSchema.parse(undefined);
      expect(result.serviceType).toBe('other');
      expect(result.standardServiceHours).toBeNull();
      expect(result.consent.explainedAt).toBeNull();
      expect(result.delivery.deliveredToUser).toBe(false);
      expect(result.reviewControl.reviewCycleDays).toBe(180);
    });

    it('生活介護のフル入力を受け付ける', () => {
      const full = {
        serviceType: 'daily_life_care' as const,
        standardServiceHours: 6.5,
        consent: {
          explainedAt: '2026-04-01T10:00:00Z',
          explainedBy: '山田花子',
          consentedAt: '2026-04-01T10:30:00Z',
          consentedBy: '田中太郎',
          proxyName: '田中次郎',
          proxyRelation: '兄',
          notes: '代理同意',
        },
        delivery: {
          deliveredAt: '2026-04-05T00:00:00Z',
          deliveredToUser: true,
          deliveredToConsultationSupport: true,
          deliveryMethod: '手渡し',
          notes: '',
        },
        reviewControl: {
          reviewCycleDays: 180,
          lastReviewedAt: '2026-04-01',
          nextReviewDueAt: '2026-10-01',
          reviewReason: '',
        },
      };
      const result = ispComplianceMetadataSchema.parse(full);
      expect(result.serviceType).toBe('daily_life_care');
      expect(result.standardServiceHours).toBe(6.5);
      expect(result.consent.proxyRelation).toBe('兄');
      expect(result.delivery.deliveredToConsultationSupport).toBe(true);
    });

    it('不正な serviceType はエラー', () => {
      expect(() =>
        ispComplianceMetadataSchema.parse({ serviceType: 'invalid' }),
      ).toThrow();
    });
  });

  // ── 後方互換: compliance 未指定の ISP ──

  describe('後方互換性', () => {
    it('ispFormSchema: compliance 無しでもパースできる', () => {
      const input = makeIspFormInput();
      // compliance を明示的に渡さない
      expect(input).not.toHaveProperty('compliance');
      const result = ispFormSchema.parse(input);
      // compliance は undefined（optional）
      expect(result.userId).toBe('U001');
    });

    it('individualSupportPlanSchema: compliance 無しでもパースできる', () => {
      const input = {
        ...baseAudit,
        userId: 'U001',
        title: 'テスト計画',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        userIntent: '意向',
        familyIntent: '',
        overallSupportPolicy: '方針',
        qolIssues: '',
        longTermGoals: ['目標'],
        shortTermGoals: ['短期'],
        supportSummary: '',
        precautions: '',
        consentAt: null,
        deliveredAt: null,
        monitoringSummary: '',
        lastMonitoringAt: null,
        nextReviewAt: null,
        status: 'assessment' as const,
        isCurrent: true,
        // compliance は渡さない
      };
      const result = individualSupportPlanSchema.parse(input);
      // Zod の .default() が効くため、デフォルト値が入る
      expect(result.compliance).toBeDefined();
      expect(result.compliance?.serviceType).toBe('other');
      expect(result.compliance?.reviewControl.reviewCycleDays).toBe(180);
    });

    it('ispFormSchema: compliance 付きでもパースできる', () => {
      const input = makeIspFormInput({
        compliance: {
          serviceType: 'daily_life_care',
          standardServiceHours: 6.0,
          consent: { consentedBy: '田中太郎' },
          delivery: { deliveredToUser: true },
          reviewControl: { reviewCycleDays: 180 },
        },
      });
      const result = ispFormSchema.parse(input);
      expect(result.compliance?.serviceType).toBe('daily_life_care');
      expect(result.compliance?.consent.consentedBy).toBe('田中太郎');
    });
  });

  // ── SharePoint 行: ComplianceJson ──

  describe('ispSpRowSchema ComplianceJson', () => {
    it('ComplianceJson が null でも正常', () => {
      const row = makeIspSpRow({ ComplianceJson: null });
      const result = ispSpRowSchema.parse(row);
      expect(result.ComplianceJson).toBeNull();
    });

    it('ComplianceJson に JSON 文字列を保存できる', () => {
      const compliance = {
        serviceType: 'daily_life_care',
        standardServiceHours: 6.5,
      };
      const row = makeIspSpRow({ ComplianceJson: JSON.stringify(compliance) });
      const result = ispSpRowSchema.parse(row);
      expect(result.ComplianceJson).toBe(JSON.stringify(compliance));
    });
  });

  // ── ユーティリティ関数 ──

  describe('isIspReviewOverdue', () => {
    it('compliance が undefined → false', () => {
      expect(isIspReviewOverdue(undefined)).toBe(false);
    });

    it('nextReviewDueAt が null → false', () => {
      const c = ispComplianceMetadataSchema.parse(undefined);
      expect(isIspReviewOverdue(c)).toBe(false);
    });

    it('期限内 → false', () => {
      const c = ispComplianceMetadataSchema.parse({
        reviewControl: { nextReviewDueAt: '2026-10-01' },
      });
      expect(isIspReviewOverdue(c, '2026-09-30')).toBe(false);
    });

    it('当日 → false（当日は超過ではない）', () => {
      const c = ispComplianceMetadataSchema.parse({
        reviewControl: { nextReviewDueAt: '2026-10-01' },
      });
      expect(isIspReviewOverdue(c, '2026-10-01')).toBe(false);
    });

    it('翌日 → true（超過）', () => {
      const c = ispComplianceMetadataSchema.parse({
        reviewControl: { nextReviewDueAt: '2026-10-01' },
      });
      expect(isIspReviewOverdue(c, '2026-10-02')).toBe(true);
    });
  });

  describe('computeIspReviewOverdueDays', () => {
    it('compliance が undefined → null', () => {
      expect(computeIspReviewOverdueDays(undefined)).toBeNull();
    });

    it('期限内 → 0', () => {
      const c = ispComplianceMetadataSchema.parse({
        reviewControl: { nextReviewDueAt: '2026-10-01' },
      });
      expect(computeIspReviewOverdueDays(c, '2026-09-15')).toBe(0);
    });

    it('3日超過 → 3', () => {
      const c = ispComplianceMetadataSchema.parse({
        reviewControl: { nextReviewDueAt: '2026-10-01' },
      });
      expect(computeIspReviewOverdueDays(c, '2026-10-04')).toBe(3);
    });
  });

  describe('validateStandardServiceHours', () => {
    it('null → null（未入力は許容）', () => {
      expect(validateStandardServiceHours(null)).toBeNull();
    });

    it('undefined → null', () => {
      expect(validateStandardServiceHours(undefined)).toBeNull();
    });

    it('正常値 → null', () => {
      expect(validateStandardServiceHours(6.5)).toBeNull();
    });

    it('0 → null（0時間も有効）', () => {
      expect(validateStandardServiceHours(0)).toBeNull();
    });

    it('負の値 → エラーメッセージ', () => {
      expect(validateStandardServiceHours(-1)).toContain('0 以上');
    });

    it('24超 → エラーメッセージ', () => {
      expect(validateStandardServiceHours(25)).toContain('24 時間以内');
    });

    it('24.0 → null（ちょうど24は許容）', () => {
      expect(validateStandardServiceHours(24)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────
// 更新パッチ: 追加項目（meeting / consultationSupport / 同意拡張 / base 追加5項目）
// ─────────────────────────────────────────────

describe('ISP 追加項目（更新パッチ）', () => {
  describe('ispConsentDetailSchema 拡張 (proxyReason / consentMethod)', () => {
    it('proxyReason / consentMethod なしでパースできる（後方互換）', () => {
      const result = ispConsentDetailSchema.parse({
        proxyName: '田中次郎',
        proxyRelation: '兄',
      });
      expect(result.proxyName).toBe('田中次郎');
      expect(result.proxyReason).toBeUndefined();
      expect(result.consentMethod).toBeUndefined();
    });

    it('proxyReason / consentMethod を設定できる', () => {
      const result = ispConsentDetailSchema.parse({
        proxyName: '田中次郎',
        proxyRelation: '兄',
        proxyReason: '本人の意思表示が困難なため',
        consentMethod: 'signature',
      });
      expect(result.proxyReason).toBe('本人の意思表示が困難なため');
      expect(result.consentMethod).toBe('signature');
    });

    it('consentMethod の不正値はエラー', () => {
      expect(() =>
        ispConsentDetailSchema.parse({ consentMethod: 'fingerprint' }),
      ).toThrow();
    });
  });

  describe('ispMeetingDetailSchema', () => {
    it('空オブジェクトからデフォルトが生成される', () => {
      const result = ispMeetingDetailSchema.parse({});
      expect(result).toEqual({
        meetingDate: null,
        meetingMinutes: '',
        attendees: [],
      });
    });

    it('会議情報を設定できる', () => {
      const result = ispMeetingDetailSchema.parse({
        meetingDate: '2026-04-10',
        meetingMinutes: '長期目標を確認、家族同席',
        attendees: ['サビ管 山田', '担当 鈴木', '本人', '母'],
      });
      expect(result.meetingDate).toBe('2026-04-10');
      expect(result.attendees).toHaveLength(4);
    });
  });

  describe('ispConsultationSupportSchema', () => {
    it('空オブジェクトからデフォルトが生成される', () => {
      const result = ispConsultationSupportSchema.parse({});
      expect(result).toEqual({
        agencyName: '',
        officerName: '',
        serviceUsePlanReceivedAt: null,
        gapNotes: '',
      });
    });

    it('相談支援情報を設定できる', () => {
      const result = ispConsultationSupportSchema.parse({
        agencyName: '相談支援センターA',
        officerName: '相談員 佐藤',
        serviceUsePlanReceivedAt: '2026-03-25',
        gapNotes: '通所頻度の記載が ISP と相違',
      });
      expect(result.agencyName).toBe('相談支援センターA');
      expect(result.serviceUsePlanReceivedAt).toBe('2026-03-25');
    });
  });

  describe('ispComplianceMetadataSchema 拡張統合', () => {
    it('meeting / consultationSupport なしでパースできる（既存データ互換）', () => {
      const result = ispComplianceMetadataSchema.parse({
        serviceType: 'daily_life_care',
      });
      expect(result.serviceType).toBe('daily_life_care');
      // 修正後: optional() から .default() に変更したため、定義済みとなる
      expect(result.meeting).toBeDefined();
      expect(result.meeting?.meetingMinutes).toBe('');
      expect(result.consultationSupport).toBeDefined();
      expect(result.consultationSupport?.agencyName).toBe('');
    });

    it('ispComplianceMetadataSchema.parse({}) で完全なデフォルト値が返る (Requested B)', () => {
      const result = ispComplianceMetadataSchema.parse({});
      expect(result.meeting).toBeDefined();
      expect(result.meeting?.attendees).toEqual([]);
      expect(result.consultationSupport).toBeDefined();
      expect(result.consultationSupport?.officerName).toBe('');
    });

    it('meeting / consultationSupport を含む完全入力を受け付ける', () => {
      const result = ispComplianceMetadataSchema.parse({
        serviceType: 'daily_life_care',
        meeting: {
          meetingDate: '2026-04-10',
          meetingMinutes: '会議実施',
          attendees: ['山田', '鈴木'],
        },
        consultationSupport: {
          agencyName: '相談支援センターA',
          officerName: '佐藤',
          serviceUsePlanReceivedAt: '2026-03-25',
          gapNotes: '',
        },
      });
      expect(result.meeting?.meetingDate).toBe('2026-04-10');
      expect(result.meeting?.attendees).toEqual(['山田', '鈴木']);
      expect(result.consultationSupport?.agencyName).toBe('相談支援センターA');
    });

    it('部分的な meeting 入力でもデフォルトで補完される', () => {
      const result = ispComplianceMetadataSchema.parse({
        meeting: { meetingDate: '2026-04-10' },
      });
      expect(result.meeting?.meetingDate).toBe('2026-04-10');
      expect(result.meeting?.meetingMinutes).toBe('');
      expect(result.meeting?.attendees).toEqual([]);
    });
  });

  describe('ispFormSchema 追加項目 (B-1)', () => {
    it('追加5項目なしでパースできる（既存フォーム互換）', () => {
      const input = makeIspFormInput();
      const result = ispFormSchema.parse(input);
      expect(result.medicalConsiderations).toBeUndefined();
      expect(result.emergencyResponsePlan).toBeUndefined();
      expect(result.rightsAdvocacy).toBeUndefined();
      expect(result.serviceStartDate).toBeUndefined();
      expect(result.firstServiceDate).toBeUndefined();
    });

    it('追加5項目を設定できる', () => {
      const input = makeIspFormInput({
        medicalConsiderations: 'てんかん発作時の対応',
        emergencyResponsePlan: '主治医連絡 → 救急要請',
        rightsAdvocacy: '本人の選好を最優先',
        serviceStartDate: '2026-04-01',
        firstServiceDate: '2026-04-03',
      });
      const result = ispFormSchema.parse(input);
      expect(result.medicalConsiderations).toBe('てんかん発作時の対応');
      expect(result.serviceStartDate).toBe('2026-04-01');
      expect(result.firstServiceDate).toBe('2026-04-03');
    });

    it('serviceStartDate の不正フォーマットはエラー', () => {
      const input = makeIspFormInput({ serviceStartDate: '2026/04/01' });
      expect(() => ispFormSchema.parse(input)).toThrow();
    });
  });

  describe('individualSupportPlanSchema 追加項目 (B-2)', () => {
    it('追加5項目なしでパースできる（既存ドメイン互換）', () => {
      const input = {
        ...baseAudit,
        userId: 'U001',
        title: 'テスト計画',
        planStartDate: '2026-04-01',
        planEndDate: '2027-03-31',
        userIntent: '意向',
        familyIntent: '',
        overallSupportPolicy: '方針',
        qolIssues: '',
        longTermGoals: ['目標'],
        shortTermGoals: ['短期'],
        supportSummary: '',
        precautions: '',
        consentAt: null,
        deliveredAt: null,
        monitoringSummary: '',
        lastMonitoringAt: null,
        nextReviewAt: null,
        status: 'assessment' as const,
        isCurrent: true,
      };
      const result = individualSupportPlanSchema.parse(input);
      expect(result.medicalConsiderations).toBeUndefined();
      expect(result.serviceStartDate).toBeUndefined();
      expect(result.firstServiceDate).toBeUndefined();

      // compliance は定義済みデフォルトが返る
      expect(result.compliance).toBeDefined();
      expect(result.compliance?.meeting).toBeDefined();
    });
  });
});
