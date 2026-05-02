import { describe, it, expect } from 'vitest';
import { bridgePlanningSheetToDailyProcedures } from '../dailyProcedureMapper';
import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';

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
        { order: 2, timing: '10:20', instruction: 'AM Activity Content', staff: 'Staff B' },
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
});
