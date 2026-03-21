/**
 * ISP 三層モデル — Repository ユニットテスト
 *
 * テスト観点:
 *   - 正しい OData フィルタの組み立て
 *   - SP 応答 → mapper → domain の変換
 *   - create/update で正しいペイロードが送られる
 *   - 結果が空のとき null / [] を返す
 *   - extractSpId のパース
 *   - WriteGate の動作（isWriteEnabled=false 時のブロック）
 *
 * spClient は全メソッドを vi.fn() でモック。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createSharePointIspRepository, extractSpId } from '../SharePointIspRepository';
import { createSharePointBehaviorMonitoringRepository } from '../SharePointBehaviorMonitoringRepository';
import { createSharePointPlanningSheetRepository } from '../SharePointPlanningSheetRepository';
import { createSharePointPlanningSheetReassessmentRepository } from '../SharePointPlanningSheetReassessmentRepository';
import { createSharePointProcedureRecordRepository } from '../SharePointProcedureRecordRepository';
import type { UseSP } from '@/lib/spClient';

// ─────────────────────────────────────────────
// Mock: isWriteEnabled
// ─────────────────────────────────────────────
let mockWriteEnabled = true;
vi.mock('@/env', () => ({
  get isWriteEnabled() { return mockWriteEnabled; },
}));

// ─────────────────────────────────────────────
// Mock SP Client
// ─────────────────────────────────────────────

function createMockClient() {
  return {
    listItems: vi.fn().mockResolvedValue([]),
    addListItemByTitle: vi.fn().mockResolvedValue({ Id: 999 }),
    updateItem: vi.fn().mockResolvedValue({}),
    // 使わないが型を満たすために必要なスタブ
    spFetch: vi.fn(),
    getListItemsByTitle: vi.fn(),
    addItemByTitle: vi.fn(),
    updateItemByTitle: vi.fn(),
    deleteItemByTitle: vi.fn(),
    getItemById: vi.fn(),
    getItemByIdWithEtag: vi.fn(),
    createItem: vi.fn(),
    deleteItem: vi.fn(),
    batch: vi.fn(),
    postBatch: vi.fn(),
    ensureListExists: vi.fn(),
    tryGetListMetadata: vi.fn(),
    getListFieldInternalNames: vi.fn(),
  } as unknown as UseSP & {
    listItems: ReturnType<typeof vi.fn>;
    addListItemByTitle: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
  };
}

// ─────────────────────────────────────────────
// SP Row ファクトリ
// ─────────────────────────────────────────────

function makeSpIspRow(id = 1) {
  return {
    Id: id,
    Title: `U001_2026-04-01`,
    UserCode: 'U001',
    PlanStartDate: '2026-04-01',
    PlanEndDate: '2027-03-31',
    UserIntent: '意向',
    FamilyIntent: '',
    OverallSupportPolicy: '方針',
    QolIssues: '',
    LongTermGoalsJson: '["目標A"]',
    ShortTermGoalsJson: '["短期目標"]',
    SupportSummary: '',
    Precautions: '',
    ConsentAt: null,
    DeliveredAt: null,
    MonitoringSummary: '',
    LastMonitoringAt: null,
    NextReviewAt: null,
    Status: 'active',
    VersionNo: 1,
    IsCurrent: true,
    FormDataJson: '{}',
    Created: '2026-04-01T09:00:00Z',
    Modified: '2026-04-01T09:00:00Z',
  };
}

function makeSpPlanningSheetRow(id = 10) {
  return {
    Id: id,
    Title: 'U001_食事_v1',
    UserCode: 'U001',
    ISPLookupId: 1,
    ISPId: 'sp-1',
    TargetScene: '食事',
    TargetDomain: null,
    ObservationFacts: '観察',
    CollectedInformation: '',
    InterpretationHypothesis: '仮説',
    SupportIssues: '課題',
    SupportPolicy: '方針',
    EnvironmentalAdjustments: '',
    ConcreteApproaches: '具体策',
    AppliedFrom: null,
    NextReviewAt: null,
    Status: 'active',
    VersionNo: 1,
    IsCurrent: true,
    FormDataJson: '{}',
    Created: '2026-04-10T09:00:00Z',
    Modified: '2026-04-10T09:00:00Z',
  };
}

function makeSpProcedureRecordRow(id = 100) {
  return {
    Id: id,
    Title: 'U001_2026-05-01',
    UserCode: 'U001',
    ISPLookupId: 1,
    ISPId: 'sp-1',
    PlanningSheetLookupId: 10,
    PlanningSheetId: 'sp-10',
    RecordDate: '2026-05-01',
    TimeSlot: '12:00-12:30',
    Activity: '昼食',
    ProcedureText: '手順テキスト',
    ExecutionStatus: 'done',
    UserResponse: '自力で食べた',
    SpecialNotes: null,
    HandoffNotes: null,
    PerformedBy: 'staff-A',
    PerformedAt: '2026-05-01T12:30:00Z',
    Created: '2026-05-01T13:00:00Z',
    Modified: '2026-05-01T13:00:00Z',
  };
}

function makeSpBehaviorMonitoringRow(id = 501) {
  return {
    Id: id,
    Title: `BM-${id}`,
    UserId: 'U001',
    PlanningSheetId: 'sp-10',
    PeriodStart: '2026-03-01',
    PeriodEnd: '2026-03-10',
    SupportEvaluationsJson: JSON.stringify([
      {
        methodDescription: '手順A',
        achievementLevel: 'effective',
        comment: '有効',
      },
    ]),
    EnvironmentFindingsJson: JSON.stringify([
      {
        adjustment: '座席調整',
        wasEffective: true,
        comment: '落ち着きあり',
      },
    ]),
    EffectiveSupports: '視覚提示',
    DifficultiesObserved: '移行時の不安',
    NewTriggersJson: JSON.stringify(['大きな音']),
    MedicalSafetyNotes: '',
    UserFeedback: '安心した',
    FamilyFeedback: '',
    RecommendedChangesJson: JSON.stringify(['手順A継続']),
    Summary: '全体として安定',
    RecordedBy: 'staff-1',
    RecordedAt: '2026-03-10T09:00:00Z',
    Created: '2026-03-10T09:00:00Z',
    Modified: '2026-03-10T09:00:00Z',
  };
}

function makeSpPlanningSheetReassessmentRow(id = 701) {
  return {
    Id: id,
    Title: `RA-${id}`,
    PlanningSheetId: 'sp-10',
    UserId: 'U001',
    ReassessmentTrigger: 'monitoring',
    ReassessmentDate: '2026-03-18',
    Summary: '再評価の要約',
    CreatedByText: 'staff-1',
    CreatedAtText: '2026-03-18',
    VersionNo: 1,
    PlanChangeDecision: 'major_revision',
    AbcSummary: 'abc',
    HypothesisReview: 'hypothesis',
    ProcedureEffectiveness: 'effective',
    EnvironmentChange: '',
    NextReassessmentAt: '2026-06-16',
    Notes: 'notes',
    ReassessedBy: 'staff-1',
    Created: '2026-03-18T10:00:00Z',
    Modified: '2026-03-18T10:00:00Z',
  };
}

// ═════════════════════════════════════════════
// extractSpId
// ═════════════════════════════════════════════

describe('extractSpId', () => {
  it('"sp-42" → 42', () => expect(extractSpId('sp-42')).toBe(42));
  it('"42" → 42', () => expect(extractSpId('42')).toBe(42));
  it('"sp-0" → null', () => expect(extractSpId('sp-0')).toBeNull());
  it('"invalid" → null', () => expect(extractSpId('invalid')).toBeNull());
  it('"sp-" → null', () => expect(extractSpId('sp-')).toBeNull());
});

// ═════════════════════════════════════════════
// ISP Repository
// ═════════════════════════════════════════════

describe('SharePointIspRepository', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
    mockWriteEnabled = true;
  });

  describe('getById', () => {
    it('SP row を domain に変換して返す', async () => {
      client.listItems.mockResolvedValueOnce([makeSpIspRow(42)]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.getById('sp-42');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sp-42');
      expect(result!.userId).toBe('U001');
      expect(client.listItems).toHaveBeenCalledWith(
        'ISP_Master',
        expect.objectContaining({ filter: 'Id eq 42' }),
      );
    });

    it('結果がないとき null を返す', async () => {
      client.listItems.mockResolvedValueOnce([]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.getById('sp-999');
      expect(result).toBeNull();
    });

    it('不正な ID で null を返す', async () => {
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.getById('invalid');
      expect(result).toBeNull();
      expect(client.listItems).not.toHaveBeenCalled();
    });
  });

  describe('listByUser', () => {
    it('UserCode でフィルタして一覧を返す', async () => {
      client.listItems.mockResolvedValueOnce([makeSpIspRow(1), makeSpIspRow(2)]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.listByUser('U001');

      expect(result).toHaveLength(2);
      expect(client.listItems).toHaveBeenCalledWith(
        'ISP_Master',
        expect.objectContaining({ filter: "UserCode eq 'U001'" }),
      );
    });

    it('結果が空なら空配列を返す', async () => {
      client.listItems.mockResolvedValueOnce([]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.listByUser('UNKNOWN');
      expect(result).toEqual([]);
    });
  });

  describe('getCurrentByUser', () => {
    it('IsCurrent でフィルタする', async () => {
      client.listItems.mockResolvedValueOnce([makeSpIspRow(1)]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.getCurrentByUser('U001');

      expect(result).not.toBeNull();
      expect(client.listItems).toHaveBeenCalledWith(
        'ISP_Master',
        expect.objectContaining({
          filter: "UserCode eq 'U001' and IsCurrent eq true",
        }),
      );
    });
  });

  describe('create', () => {
    it('ペイロードを送信して再取得する', async () => {
      client.addListItemByTitle.mockResolvedValueOnce({ Id: 50 });
      client.listItems.mockResolvedValueOnce([makeSpIspRow(50)]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.create({
        userId: 'U001',
        title: 'テスト',
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
        status: 'assessment',
      });

      expect(result.id).toBe('sp-50');
      expect(client.addListItemByTitle).toHaveBeenCalledWith(
        'ISP_Master',
        expect.objectContaining({ UserCode: 'U001', Status: 'assessment' }),
      );
    });

    it('write 無効時にエラーをスローする', async () => {
      mockWriteEnabled = false;
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      await expect(repo.create({
        userId: 'U001', title: 'x', planStartDate: '2026-01-01', planEndDate: '2027-01-01',
        userIntent: 'x', familyIntent: '', overallSupportPolicy: 'x', qolIssues: '',
        longTermGoals: ['g'], shortTermGoals: ['s'], supportSummary: '', precautions: '',
        status: 'assessment',
      })).rejects.toThrow('disabled');
    });
  });

  describe('update', () => {
    it('部分更新ペイロードを送信して再取得する', async () => {
      client.listItems.mockResolvedValueOnce([makeSpIspRow(42)]);
      const repo = createSharePointIspRepository(client as unknown as UseSP);

      const result = await repo.update('sp-42', { status: 'monitoring' });

      expect(result.id).toBe('sp-42');
      expect(client.updateItem).toHaveBeenCalledWith(
        'ISP_Master', 42,
        expect.objectContaining({ Status: 'monitoring' }),
      );
    });
  });
});

// ═════════════════════════════════════════════
// PlanningSheet Repository
// ═════════════════════════════════════════════

describe('SharePointPlanningSheetRepository', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
    mockWriteEnabled = true;
  });

  describe('getById', () => {
    it('SP row を domain に変換して返す', async () => {
      client.listItems.mockResolvedValueOnce([makeSpPlanningSheetRow(10)]);
      const repo = createSharePointPlanningSheetRepository(client as unknown as UseSP);

      const result = await repo.getById('sp-10');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('sp-10');
    });

    it('結果がないとき null を返す', async () => {
      client.listItems.mockResolvedValueOnce([]);
      const repo = createSharePointPlanningSheetRepository(client as unknown as UseSP);

      expect(await repo.getById('sp-999')).toBeNull();
    });
  });

  describe('listByIsp', () => {
    it('ISPId でフィルタする', async () => {
      client.listItems.mockResolvedValueOnce([makeSpPlanningSheetRow(10)]);
      const repo = createSharePointPlanningSheetRepository(client as unknown as UseSP);

      const result = await repo.listByIsp('sp-1');
      expect(result).toHaveLength(1);
      expect(client.listItems).toHaveBeenCalledWith(
        'SupportPlanningSheet_Master',
        expect.objectContaining({ filter: "ISPId eq 'sp-1'" }),
      );
    });
  });

  describe('listCurrentByUser', () => {
    it('UserCode + IsCurrent でフィルタする', async () => {
      client.listItems.mockResolvedValueOnce([]);
      const repo = createSharePointPlanningSheetRepository(client as unknown as UseSP);

      const result = await repo.listCurrentByUser('U001');
      expect(result).toEqual([]);
      expect(client.listItems).toHaveBeenCalledWith(
        'SupportPlanningSheet_Master',
        expect.objectContaining({
          filter: "UserCode eq 'U001' and IsCurrent eq true",
        }),
      );
    });
  });

  describe('create', () => {
    it('write 無効時にエラーをスローする', async () => {
      mockWriteEnabled = false;
      const repo = createSharePointPlanningSheetRepository(client as unknown as UseSP);

      await expect(repo.create({
        userId: 'U001', ispId: 'sp-1', title: 'x', targetScene: '', targetDomain: '',
        observationFacts: 'x', collectedInformation: '', interpretationHypothesis: 'x',
        supportIssues: 'x', supportPolicy: 'x', environmentalAdjustments: '',
        concreteApproaches: 'x',
        authoredByStaffId: '', authoredByQualification: 'unknown',
        applicableServiceType: 'other', applicableAddOnTypes: ['none'],
        hasMedicalCoordination: false, hasEducationCoordination: false,
        monitoringCycleDays: 90,
        status: 'draft',
      })).rejects.toThrow('disabled');
    });
  });
});

// ═════════════════════════════════════════════
// ProcedureRecord Repository
// ═════════════════════════════════════════════

describe('SharePointProcedureRecordRepository', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
    mockWriteEnabled = true;
  });

  describe('getById', () => {
    it('SP row を domain に変換して返す', async () => {
      client.listItems.mockResolvedValueOnce([makeSpProcedureRecordRow(100)]);
      const repo = createSharePointProcedureRecordRepository(client as unknown as UseSP);

      const result = await repo.getById('sp-100');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('sp-100');
      expect(result!.executionStatus).toBe('done');
    });
  });

  describe('listByPlanningSheet', () => {
    it('PlanningSheetId でフィルタする', async () => {
      client.listItems.mockResolvedValueOnce([makeSpProcedureRecordRow(100)]);
      const repo = createSharePointProcedureRecordRepository(client as unknown as UseSP);

      const result = await repo.listByPlanningSheet('sp-10');
      expect(result).toHaveLength(1);
      expect(client.listItems).toHaveBeenCalledWith(
        'SupportProcedureRecord_Daily',
        expect.objectContaining({ filter: "PlanningSheetId eq 'sp-10'" }),
      );
    });
  });

  describe('listByUserAndDate', () => {
    it('UserCode + RecordDate の複合フィルタ', async () => {
      client.listItems.mockResolvedValueOnce([]);
      const repo = createSharePointProcedureRecordRepository(client as unknown as UseSP);

      const result = await repo.listByUserAndDate('U001', '2026-05-01');
      expect(result).toEqual([]);
      expect(client.listItems).toHaveBeenCalledWith(
        'SupportProcedureRecord_Daily',
        expect.objectContaining({
          filter: "UserCode eq 'U001' and RecordDate eq '2026-05-01'",
        }),
      );
    });
  });

  describe('create', () => {
    it('ペイロードを送信して再取得する', async () => {
      client.addListItemByTitle.mockResolvedValueOnce({ Id: 200 });
      client.listItems.mockResolvedValueOnce([makeSpProcedureRecordRow(200)]);
      const repo = createSharePointProcedureRecordRepository(client as unknown as UseSP);

      const result = await repo.create({
        userId: 'U001', planningSheetId: 'sp-10', recordDate: '2026-05-01',
        timeSlot: '12:00', activity: '昼食', procedureText: '手順',
        executionStatus: 'done', userResponse: '', specialNotes: '', handoffNotes: '',
        performedBy: 'staff-A', performedAt: '2026-05-01T12:00:00Z',
      });

      expect(result.id).toBe('sp-200');
    });

    it('write 無効時にエラーをスローする', async () => {
      mockWriteEnabled = false;
      const repo = createSharePointProcedureRecordRepository(client as unknown as UseSP);

      await expect(repo.create({
        userId: 'U001', planningSheetId: 'sp-10', recordDate: '2026-05-01',
        timeSlot: '', activity: '', procedureText: 'x',
        executionStatus: 'planned', userResponse: '', specialNotes: '', handoffNotes: '',
        performedBy: 'staff-A', performedAt: '2026-05-01T12:00:00Z',
      })).rejects.toThrow('disabled');
    });
  });

  describe('update', () => {
    it('部分更新が正しく送信される', async () => {
      client.listItems.mockResolvedValueOnce([makeSpProcedureRecordRow(100)]);
      const repo = createSharePointProcedureRecordRepository(client as unknown as UseSP);

      const result = await repo.update('sp-100', { executionStatus: 'skipped' });

      expect(result.id).toBe('sp-100');
      expect(client.updateItem).toHaveBeenCalledWith(
        'SupportProcedureRecord_Daily', 100,
        expect.objectContaining({ ExecutionStatus: 'skipped' }),
      );
    });
  });
});

// ═════════════════════════════════════════════
// BehaviorMonitoring Repository
// ═════════════════════════════════════════════

describe('SharePointBehaviorMonitoringRepository', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  it('planningSheetId + userId でフィルタして一覧を返す', async () => {
    client.listItems.mockResolvedValueOnce([makeSpBehaviorMonitoringRow(501)]);
    const repo = createSharePointBehaviorMonitoringRepository(
      client as unknown as UseSP,
    );

    const result = await repo.findByPlanningSheetId({
      planningSheetId: 'sp-10',
      userId: 'U001',
    });

    expect(result).toHaveLength(1);
    expect(result[0].planningSheetId).toBe('sp-10');
    expect(result[0].supportEvaluations[0]?.achievementLevel).toBe('effective');
    expect(client.listItems).toHaveBeenCalledWith(
      'BehaviorMonitoringRecord_Master',
      expect.objectContaining({
        filter: "PlanningSheetId eq 'sp-10' and UserId eq 'U001'",
      }),
    );
  });

  it('不正データは schema で弾く', async () => {
    // planningSheetId を欠損させて schema エラーを誘発
    client.listItems.mockResolvedValueOnce([
      {
        ...makeSpBehaviorMonitoringRow(502),
        PlanningSheetId: '',
      },
    ]);

    const repo = createSharePointBehaviorMonitoringRepository(
      client as unknown as UseSP,
    );

    await expect(
      repo.findByPlanningSheetId({
        planningSheetId: 'sp-10',
        userId: 'U001',
      }),
    ).rejects.toThrow('Invalid row data');
  });
});

// ═════════════════════════════════════════════
// PlanningSheetReassessment Repository
// ═════════════════════════════════════════════

describe('SharePointPlanningSheetReassessmentRepository', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  it('planningSheetId でフィルタして再評価一覧を返す', async () => {
    client.listItems.mockResolvedValueOnce([
      makeSpPlanningSheetReassessmentRow(701),
    ]);
    const repo = createSharePointPlanningSheetReassessmentRepository(
      client as unknown as UseSP,
    );

    const result = await repo.findByPlanningSheetId({
      planningSheetId: 'sp-10',
    });

    expect(result).toHaveLength(1);
    expect(result[0].planChangeDecision).toBe('major_revision');
    expect(result[0].triggerType).toBe('monitoring');
    expect(client.listItems).toHaveBeenCalledWith(
      'PlanningSheetReassessment_Master',
      expect.objectContaining({
        filter: "PlanningSheetId eq 'sp-10'",
      }),
    );
  });

  it('データ未設定時は空配列', async () => {
    client.listItems.mockResolvedValueOnce([]);
    const repo = createSharePointPlanningSheetReassessmentRepository(
      client as unknown as UseSP,
    );

    const result = await repo.findByPlanningSheetId({
      planningSheetId: 'sp-10',
    });

    expect(result).toEqual([]);
  });
});
