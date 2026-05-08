import { describe, it, expect } from 'vitest';
import { bridgePlanningSheetToDailyProcedures } from '../dailyProcedureMapper';
import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';
import { SHIODA_SEVERE_SUPPORT_SHEET } from '../__fixtures__/shiotaSevereSupportProcedure';
import { KATSURAGAWA_SEVERE_SUPPORT_SHEET } from '../__fixtures__/katsuragawaSevereSupportProcedure';
import { NAKAMURA_SEVERE_SUPPORT_SHEET } from '../__fixtures__/nakamuraSevereSupportProcedure';
import { ISHIWATA_SEVERE_SUPPORT_SHEET } from '../__fixtures__/ishiwataSevereSupportProcedure';

describe('dailyProcedureMapper', () => {
  const mockSheet: Partial<SupportPlanningSheet> = {
    id: 'sheet-1',
    userId: 'user-1',
    supportPolicy: 'Policy text',
    concreteApproaches: 'Approach text',
    environmentalAdjustments: 'Env text',
    intake: {
      sensoryTriggers: ['Trigger 1'],
      medicalFlags: ['Flag 1'],
      presentingProblem: '',
      targetBehaviorsDraft: [],
      behaviorItemsTotal: null,
      incidentSummaryLast30d: '',
      communicationModes: [],
      consentScope: [],
      consentDate: null,
    },
    planning: {
      procedureSteps: [
        { order: 1, timing: '09:30', instruction: 'Morning Prep', staff: 'Staff A' },
        { order: 5, timing: '10:20', instruction: 'AM Activity Content', staff: 'Staff B' },
      ],
      supportPriorities: [],
      antecedentStrategies: [],
      teachingStrategies: [],
      consequenceStrategies: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    authoredByStaffId: 'staff-1',
  };

  it('should map structured steps to correct rows', () => {
    const doc = bridgePlanningSheetToDailyProcedures(mockSheet as SupportPlanningSheet);
    
    // Row 1 (9:30頃 - 通所・朝の準備) should be mapped
    const row1 = doc.rows.find(r => r.rowNo === 1);
    expect(row1?.personAction).toBe('Morning Prep');
    expect(row1?.supporterAction).toBe('Staff A');

    // Row 5 (10:20〜12:00 - AM日中活動) should be mapped
    const row5 = doc.rows.find(r => r.rowNo === 5);
    expect(row5?.personAction).toBe('AM Activity Content');
    expect(row5?.supporterAction).toBe('Staff B');
  });

  it('should populate header and footer fields', () => {
    const doc = bridgePlanningSheetToDailyProcedures(mockSheet as SupportPlanningSheet, {
      userName: 'Test User',
      staffName: 'Staff X',
      recordDate: '2026/05/02',
    });

    expect(doc.userName).toBe('Test User');
    expect(doc.staffName).toBe('Staff X');
    expect(doc.recordDate).toBe('2026/05/02');
    expect(doc.specialNotes).toContain('【環境調整】Env text');
    expect(doc.specialNotes).toContain('【感覚トリガー】Trigger 1');
  });

  it('should map detailed fields (activityDetail, instructionDetail, condition) if provided', () => {
    const detailedSheet = {
      ...mockSheet,
      planning: {
        ...mockSheet.planning,
        procedureSteps: [
          { 
            order: 1, 
            timing: '09:30', 
            instruction: 'Name only', 
            staff: 'Staff only',
            activityDetail: 'Detailed Person Action',
            instructionDetail: 'Detailed Staff Action',
            condition: 'Specific Condition'
          },
        ],
      },
    } as SupportPlanningSheet;

    const doc = bridgePlanningSheetToDailyProcedures(detailedSheet);
    const row1 = doc.rows.find(r => r.rowNo === 1);
    
    expect(row1?.personAction).toBe('Detailed Person Action');
    expect(row1?.supporterAction).toBe('Detailed Staff Action');
    expect(row1?.condition).toBe('Specific Condition');
  });

  it('should fallback to text items if no structured steps', () => {
    const textOnlySheet = {
      ...mockSheet,
      planning: { ...mockSheet.planning, procedureSteps: [] },
    } as SupportPlanningSheet;

    const doc = bridgePlanningSheetToDailyProcedures(textOnlySheet);
    const amRow = doc.rows.find(r => r.activity === 'AM日中活動');
    
    expect(amRow?.personAction).toContain('【対応方針】\nPolicy text');
    expect(amRow?.supporterAction).toContain('【具体策】\nApproach text');
  });

  describe('Shiota-san Severe Support Case (17-Row Validation)', () => {
    // Note: fixture is imported at top
    it('should map all 17 rows correctly including external activities', () => {
      const doc = bridgePlanningSheetToDailyProcedures(SHIODA_SEVERE_SUPPORT_SHEET);

      // Verify row count
      expect(doc.rows.length).toBe(17);

      // Verify Row 1 (Timing override: 9:40頃)
      const row1 = doc.rows.find(r => r.rowNo === 1);
      expect(row1?.personAction).toContain('手洗い、消毒');
      expect(row1?.condition).toBe('笑顔で入室');

      // Verify Row 13 (Activity override: ダンスタイム)
      const row13 = doc.rows.find(r => r.rowNo === 13);
      expect(row13?.activity).toContain('のんびりタイム・ダンスタイム');
      expect(row13?.personAction).toContain('ダンスを踊る');
      expect(row13?.supporterAction).toContain('好きな曲をかけ');

      // Verify Row 16 & 17 (External Activities)
      const row16 = doc.rows.find(r => r.rowNo === 16);
      const row17 = doc.rows.find(r => r.rowNo === 17);
      
      expect(row16?.activity).toBe('AM/PM日中活動（外活動準備）');
      expect(row16?.supporterAction).toContain('トイレ、帽子');
      
      expect(row17?.activity).toBe('AM/PM日中活動（外活動）');
      expect(row17?.supporterAction).toContain('安全確認');
    });

    it('should maintain RowNo priority even if timing matches template weakly', () => {
      const doc = bridgePlanningSheetToDailyProcedures(SHIODA_SEVERE_SUPPORT_SHEET);
      
      // Row 1 timing is '09:40頃', but RowNo is 1. Template Row 1 timing is '9:30頃'.
      // The mapper should prefer order/RowNo over timing string matching.
      const row1 = doc.rows.find(r => r.rowNo === 1);
      expect(row1?.personAction).toBe('手洗い、消毒。荷物を入れる。');
    });

    it('should map overall sheet notes (dailyCarePoints, otherNotes) unique to Shiota-san', () => {
      const doc = bridgePlanningSheetToDailyProcedures(SHIODA_SEVERE_SUPPORT_SHEET);

      expect(doc.dailyCarePoints).toBe('見通しを持って落ち着いて活動に取り組む。ハサミ以外の没頭できる活動の探索。');
      expect(doc.otherNotes).toContain('【観察事実】\nハサミに没頭すると切り替えが困難。');
      expect(doc.otherNotes).toContain('【環境調整】\nスケジュール表の提示。');
      expect(doc.otherNotes).toContain('【具体的対応】\n写真カードによる選択肢提示。');
    });

    it('should resolve Shiota aliases when userId is production UserID I016', () => {
      // SHIODA_SEVERE_SUPPORT_SHEET already uses I016, but we test the explicit mapping here
      const doc = bridgePlanningSheetToDailyProcedures({
        ...SHIODA_SEVERE_SUPPORT_SHEET,
        userId: 'I016',
      });

      expect(doc.dailyCarePoints).toContain('ハサミ以外の没頭できる活動');
      expect(doc.rows.find((row) => row.rowNo === 13)?.personAction).toContain('ダンスを踊る');
    });
  });

  describe('Katsuragawa-san Severe Support Case (17-Row Validation)', () => {
    it('should map all 17 rows correctly including external activities', () => {
      const doc = bridgePlanningSheetToDailyProcedures(KATSURAGAWA_SEVERE_SUPPORT_SHEET);

      // Verify row count
      expect(doc.rows.length).toBe(17);

      // Verify Row 1 (Morning Prep)
      const row1 = doc.rows.find(r => r.rowNo === 1);
      expect(row1?.activity).toContain('通所・朝の準備');
      expect(row1?.personAction).toContain('手洗い 荷物をロッカーへ');

      // Verify Row 5 (AM Activity)
      const row5 = doc.rows.find(r => r.rowNo === 5);
      expect(row5?.activity).toBe('AM日中活動');
      expect(row5?.personAction).toContain('ビーズの種類分け');

      // Verify Row 8 (Afternoon - Blood pressure check)
      const row8 = doc.rows.find(r => r.rowNo === 8);
      expect(row8?.activity).toBe('昼休み');
      expect(row8?.supporterAction).toContain('血圧測定');

      // Verify Row 16 & 17 (External Activities)
      const row16 = doc.rows.find(r => r.rowNo === 16);
      const row17 = doc.rows.find(r => r.rowNo === 17);
      
      expect(row16?.activity).toContain('AM/PM日中活動（外活動準備）');
      expect(row16?.personAction).toContain('着替えを持つ');
      
      expect(row17?.activity).toContain('AM/PM日中活動（外活動）');
      // Row 17 for Katsuragawa-san in Excel was empty except for header
      expect(row17?.personAction).toBe('AM PM日中活動 (外活動)');
    });

    it('should map overall sheet notes (dailyCarePoints, otherNotes) unique to Katsuragawa-san', () => {
      const doc = bridgePlanningSheetToDailyProcedures(KATSURAGAWA_SEVERE_SUPPORT_SHEET);

      expect(doc.dailyCarePoints).toBe('本人のペースを尊重し、見通しを持てるように視覚的支援を行う。');
      expect(doc.otherNotes).toBe('視覚的スケジュールの提示、イヤーマフの活用。\n短い言葉で具体的に伝える。');
    });

    it('should resolve Katsuragawa aliases when userId is production SP UserID I009', () => {
      const doc = bridgePlanningSheetToDailyProcedures({
        ...KATSURAGAWA_SEVERE_SUPPORT_SHEET,
        userId: 'I009',
      });

      expect(doc.dailyCarePoints).toBe('本人のペースを尊重し、見通しを持てるように視覚的支援を行う。');
      expect(doc.rows.find((row) => row.rowNo === 5)?.personAction).toContain('ビーズの種類分け');
    });

    it('should resolve Katsuragawa aliases when userId is production SP item id 10', () => {
      const doc = bridgePlanningSheetToDailyProcedures({
        ...KATSURAGAWA_SEVERE_SUPPORT_SHEET,
        userId: '10',
      });

      expect(doc.dailyCarePoints).toBe('本人のペースを尊重し、見通しを持てるように視覚的支援を行う。');
      expect(doc.rows.find((row) => row.rowNo === 1)?.personAction).toContain('手洗い 荷物をロッカーへ');
    });
  });

  describe('Nakamura-san Severe Support Case (17-Row Validation)', () => {
    it('should map all 17 rows correctly including external activities', () => {
      const doc = bridgePlanningSheetToDailyProcedures(NAKAMURA_SEVERE_SUPPORT_SHEET);

      // Verify row count
      expect(doc.rows.length).toBe(17);

      // Verify Row 1 (Morning Prep - 9:20頃)
      const row1 = doc.rows.find(r => r.rowNo === 1);
      expect(row1?.personAction).toContain('家族の送迎で来所');

      // Verify Row 5 (AM Activity - タオル作業)
      const row5 = doc.rows.find(r => r.rowNo === 5);
      expect(row5?.activity).toBe('AM日中活動');
      expect(row5?.personAction).toContain('タオル作業');

      // Verify Row 8 (Lunch break - 財布管理)
      const row8 = doc.rows.find(r => r.rowNo === 8);
      expect(row8?.activity).toBe('昼休み');
      expect(row8?.supporterAction).toContain('財布の声掛け');

      // Verify Row 13 (のんびりタイム - 動画鑑賞)
      const row13 = doc.rows.find(r => r.rowNo === 13);
      expect(row13?.activity).toContain('のんびりタイム');
      expect(row13?.personAction).toContain('動画鑑賞');

      // Verify Row 16 & 17 (External Activities)
      const row16 = doc.rows.find(r => r.rowNo === 16);
      const row17 = doc.rows.find(r => r.rowNo === 17);

      expect(row16?.activity).toContain('AM/PM日中活動（外活動準備）');
      expect(row16?.supporterAction).toContain('トイレの声掛け');

      expect(row17?.activity).toContain('AM/PM日中活動（外活動）');
      expect(row17?.supporterAction).toContain('写真を撮る');
    });

    it('should capture sensory triggers unique to Nakamura-san', () => {
      const doc = bridgePlanningSheetToDailyProcedures(NAKAMURA_SEVERE_SUPPORT_SHEET);

      // specialNotes should include sensory triggers
      expect(doc.specialNotes).toContain('かさぶた');
      expect(doc.specialNotes).toContain('ささくれ');
    });

    it('should map overall sheet notes (dailyCarePoints, otherNotes) unique to Nakamura-san', () => {
      const doc = bridgePlanningSheetToDailyProcedures(NAKAMURA_SEVERE_SUPPORT_SHEET);

      expect(doc.dailyCarePoints).toBe(
        '見通しを持ち、安心して活動に取り組む。制限エリア（プレイルーム・和室・給食室）への進入防止と自主課題の充実。'
      );
      expect(doc.otherNotes).toContain('かさぶた・ささくれ・靴下の糸を気にする');
      expect(doc.otherNotes).toContain('スケジュール表の提示');
      expect(doc.otherNotes).toContain('写真カードによる活動の提示');
    });

    it('should resolve Nakamura aliases when userId is numeric DEMO_USERS id', () => {
      // NAKAMURA_SEVERE_SUPPORT_SHEET uses userId: 'I017' (fixture alias)
      // USER_PROCEDURE_DETAILS uses userId: 7 (DEMO_USERS Id)
      // The alias resolver should bridge them via isNakamuraUserId
      const doc = bridgePlanningSheetToDailyProcedures({
        ...NAKAMURA_SEVERE_SUPPORT_SHEET,
        userId: '7',
      });

      expect(doc.dailyCarePoints).toContain('制限エリア');
      expect(doc.rows.find((row) => row.rowNo === 5)?.personAction).toContain('タオル作業');
    });

    it('should resolve Nakamura aliases when userId is U-006', () => {
      const doc = bridgePlanningSheetToDailyProcedures({
        ...NAKAMURA_SEVERE_SUPPORT_SHEET,
        userId: 'U-006',
      });

      expect(doc.dailyCarePoints).toContain('制限エリア');
      expect(doc.rows.find((row) => row.rowNo === 8)?.supporterAction).toContain('財布の声掛け');
    });

    it('should resolve Nakamura aliases when userId is production SP item id 23', () => {
      const doc = bridgePlanningSheetToDailyProcedures({
        ...NAKAMURA_SEVERE_SUPPORT_SHEET,
        userId: '23',
      });

      expect(doc.dailyCarePoints).toContain('制限エリア');
      expect(doc.rows.find((row) => row.rowNo === 1)?.personAction).toContain('家族の送迎で来所');
    });
  });

  describe('Ishiwata-san Severe Support Case (17-Row Validation)', () => {
    it('should map all 17 rows correctly including external activities', () => {
      const doc = bridgePlanningSheetToDailyProcedures(ISHIWATA_SEVERE_SUPPORT_SHEET);

      // Verify row count
      expect(doc.rows.length).toBe(17);

      // Verify Row 1 (Morning Prep)
      const row1 = doc.rows.find(r => r.rowNo === 1);
      expect(row1?.personAction).toContain('送迎車で来所');
      expect(row1?.supporterAction).toContain('送迎担当と引継ぎ');

      // Verify Row 5 (AM Activity)
      const row5 = doc.rows.find(r => r.rowNo === 5);
      expect(row5?.personAction).toContain('第二作業室で本や小道具');
      expect(row5?.supporterAction).toContain('活動準備 トイレ誘導');

      // Verify Row 8 (Lunch break)
      const row8 = doc.rows.find(r => r.rowNo === 8);
      expect(row8?.personAction).toContain('動画鑑賞 コーヒー注文');
      expect(row8?.supporterAction).toContain('タブレットの順番管理');

      // Verify Row 14 (帰りの準備)
      const row14 = doc.rows.find(r => r.rowNo === 14);
      expect(row14?.personAction).toContain('帰りの準備 室内にいる');
      expect(row14?.supporterAction).toContain('トイレ誘導・介助 帰りの準備');

      // Verify Row 16 & 17 (External Activities)
      const row16 = doc.rows.find(r => r.rowNo === 16);
      const row17 = doc.rows.find(r => r.rowNo === 17);

      expect(row16?.activity).toContain('AM/PM日中活動（外活動準備）');
      expect(row16?.personAction).toContain('出発前のトイレ');
      expect(row16?.supporterAction).toContain('自動ドアの前で写真を撮る');

      expect(row17?.activity).toContain('AM/PM日中活動（外活動）');
      expect(row17?.personAction).toContain('出発前のトイレ');
      expect(row17?.supporterAction).toContain('自動ドアの前で写真を撮る');
    });

    it('should map overall sheet notes (dailyCarePoints, otherNotes) unique to Ishiwata-san', () => {
      const doc = bridgePlanningSheetToDailyProcedures(ISHIWATA_SEVERE_SUPPORT_SHEET);

      expect(doc.dailyCarePoints).toBe('自発的な排泄要望がないため、こまめな支援者間の情報共有が必要。');
      expect(doc.otherNotes).toBe('個別のタイミングを考慮した声掛けと、手洗い・消毒用の設備配置。');
    });

    it('should resolve Ishiwata aliases when userId is numeric route id', () => {
      const doc = bridgePlanningSheetToDailyProcedures({
        ...ISHIWATA_SEVERE_SUPPORT_SHEET,
        userId: '6',
      });

      expect(doc.dailyCarePoints).toBe('自発的な排泄要望がないため、こまめな支援者間の情報共有が必要。');
      expect(doc.rows.find((row) => row.rowNo === 1)?.personAction).toContain('送迎車で来所');
    });

    it('should resolve Ishiwata aliases when userId is production SP Title I005', () => {
      const doc = bridgePlanningSheetToDailyProcedures({
        ...ISHIWATA_SEVERE_SUPPORT_SHEET,
        userId: 'I005',
      });

      expect(doc.dailyCarePoints).toBe('自発的な排泄要望がないため、こまめな支援者間の情報共有が必要。');
      expect(doc.rows.find((row) => row.rowNo === 1)?.personAction).toContain('送迎車で来所');
    });
  });
});
