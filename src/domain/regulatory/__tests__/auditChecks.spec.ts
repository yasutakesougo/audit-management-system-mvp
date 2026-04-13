/**
 * 監査判定 — ユニットテスト
 *
 * テスト観点:
 *   - 各判定関数の正常系・異常系
 *   - 境界条件（ちょうど10点、ちょうど区分4、期限当日等）
 *   - バンドルビルダーの統合テスト
 *   - 集計ヘルパーの計算正確性
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  getPlanningSheetMissingRisk,
  getAuthorQualificationRisk,
  getReviewOverdueRisk,
  getReviewApproachingRisk,
  getProcedureRecordGapRisk,
  getDeliveryMissingRisk,
  getAddOnCandidateFindings,
  buildRegulatoryFindings,
  summarizeFindings,
  _resetFindingCounter,
  type SheetAuditInfo,
  type RecordAuditInfo,
  type AuditCheckInput,
} from '@/domain/regulatory';
import type { UserRegulatoryProfile } from '@/domain/regulatory';
import type { StaffQualificationProfile } from '@/domain/regulatory';

// ─────────────────────────────────────────────
// テストデータファクトリ
// ─────────────────────────────────────────────

const TODAY = '2026-03-12';

function makeUserProfile(overrides: Partial<UserRegulatoryProfile> = {}): UserRegulatoryProfile {
  return {
    userId: 'U001',
    behaviorScore: 14,
    childBehaviorScore: null,
    disabilitySupportLevel: '4',
    serviceTypes: ['daily_life_care'],
    severeBehaviorSupportEligible: true,
    eligibilityCheckedAt: '2026-02-01',
    ...overrides,
  };
}

function makeSheet(overrides: Partial<SheetAuditInfo> = {}): SheetAuditInfo {
  return {
    id: 'sheet-1',
    userId: 'U001',
    title: '食事場面の支援計画',
    authoredByStaffId: 'S001',
    authoredByQualification: 'practical_training',
    applicableAddOnTypes: ['severe_disability_support'],
    nextReviewAt: '2026-06-01',
    deliveredToUserAt: '2026-03-05',
    status: 'active',
    isCurrent: true,
    ...overrides,
  };
}

function makeStaffProfile(overrides: Partial<StaffQualificationProfile> = {}): StaffQualificationProfile {
  return {
    staffId: 'S001',
    hasPracticalTraining: true,
    hasBasicTraining: true,
    hasBehaviorGuidanceTraining: false,
    hasCorePersonTraining: false,
    certificationCheckedAt: '2026-01-15',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<RecordAuditInfo> = {}): RecordAuditInfo {
  return {
    id: 'rec-1',
    planningSheetId: 'sheet-1',
    recordDate: '2026-03-10',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
beforeEach(() => {
  _resetFindingCounter();
});

// ═════════════════════════════════════════════
// 1. getPlanningSheetMissingRisk
// ═════════════════════════════════════════════

describe('getPlanningSheetMissingRisk', () => {
  it('対象候補 + シートなし → finding', () => {
    const user = makeUserProfile();
    const result = getPlanningSheetMissingRisk(user, [], TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('planning_sheet_missing');
    expect(result!.severity).toBe('high');
    expect(result!.message).toContain('14点');
  });

  it('対象候補 + 現行シートあり → null', () => {
    const user = makeUserProfile();
    const result = getPlanningSheetMissingRisk(user, [makeSheet()], TODAY);
    expect(result).toBeNull();
  });

  it('点数不足 → null', () => {
    const user = makeUserProfile({ behaviorScore: 9 });
    const result = getPlanningSheetMissingRisk(user, [], TODAY);
    expect(result).toBeNull();
  });

  it('区分不足 → null', () => {
    const user = makeUserProfile({ disabilitySupportLevel: '3' });
    const result = getPlanningSheetMissingRisk(user, [], TODAY);
    expect(result).toBeNull();
  });

  it('ちょうど10点・区分4 → finding', () => {
    const user = makeUserProfile({ behaviorScore: 10, disabilitySupportLevel: '4' });
    const result = getPlanningSheetMissingRisk(user, [], TODAY);
    expect(result).not.toBeNull();
  });

  it('archived シートのみ → finding', () => {
    const user = makeUserProfile();
    const result = getPlanningSheetMissingRisk(user, [makeSheet({ status: 'archived' })], TODAY);
    expect(result).not.toBeNull();
  });
});

// ═════════════════════════════════════════════
// 2. getAuthorQualificationRisk
// ═════════════════════════════════════════════

describe('getAuthorQualificationRisk', () => {
  it('作成者が実践研修修了 → null', () => {
    const result = getAuthorQualificationRisk(makeSheet(), makeStaffProfile(), TODAY);
    expect(result).toBeNull();
  });

  it('作成者が基礎研修のみ → finding', () => {
    const staff = makeStaffProfile({ hasPracticalTraining: false, hasBasicTraining: true });
    const result = getAuthorQualificationRisk(makeSheet(), staff, TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('author_qualification_missing');
    expect(result!.severity).toBe('medium');
  });

  it('作成者未登録 → high finding', () => {
    const result = getAuthorQualificationRisk(makeSheet(), null, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('high');
    expect(result!.message).toContain('未登録');
  });

  it('中核的人材 → null', () => {
    const staff = makeStaffProfile({ hasPracticalTraining: false, hasCorePersonTraining: true });
    const result = getAuthorQualificationRisk(makeSheet(), staff, TODAY);
    expect(result).toBeNull();
  });

  it('archived シート → null（チェック対象外）', () => {
    const result = getAuthorQualificationRisk(makeSheet({ status: 'archived' }), null, TODAY);
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════
// 3. getReviewOverdueRisk
// ═════════════════════════════════════════════

describe('getReviewOverdueRisk', () => {
  it('期限超過 → finding', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-02-01' });
    const result = getReviewOverdueRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('review_overdue');
    expect(result!.overdueDays).toBeLessThan(0);
  });

  it('30日以上超過 → high', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-01-01' });
    const result = getReviewOverdueRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('high');
  });

  it('29日以下超過 → medium', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-02-15' });
    const result = getReviewOverdueRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('medium');
  });

  it('期限内 → null', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-06-01' });
    const result = getReviewOverdueRisk(sheet, TODAY);
    expect(result).toBeNull();
  });

  it('当日 → null（まだ超過していない）', () => {
    const sheet = makeSheet({ nextReviewAt: TODAY });
    const result = getReviewOverdueRisk(sheet, TODAY);
    expect(result).toBeNull();
  });

  it('nextReviewAt が null → null', () => {
    const sheet = makeSheet({ nextReviewAt: null });
    const result = getReviewOverdueRisk(sheet, TODAY);
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════
// 3b. getReviewApproachingRisk
// ═════════════════════════════════════════════

describe('getReviewApproachingRisk', () => {
  it('期限まで14日以内 → review_approaching finding', () => {
    // TODAY = 2026-03-12, nextReviewAt = 2026-03-22 → 10日後
    const sheet = makeSheet({ nextReviewAt: '2026-03-22' });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('review_approaching');
    expect(result!.overdueDays).toBe(10);
  });

  it('7日以内 → medium severity', () => {
    // TODAY = 2026-03-12, nextReviewAt = 2026-03-17 → 5日後
    const sheet = makeSheet({ nextReviewAt: '2026-03-17' });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('medium');
  });

  it('8〜14日 → low severity', () => {
    // TODAY = 2026-03-12, nextReviewAt = 2026-03-22 → 10日後
    const sheet = makeSheet({ nextReviewAt: '2026-03-22' });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('low');
  });

  it('当日（0日後）→ finding（medium）', () => {
    const sheet = makeSheet({ nextReviewAt: TODAY });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('medium');
    expect(result!.overdueDays).toBe(0);
  });

  it('15日以上先 → null', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-06-01' });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).toBeNull();
  });

  it('期限超過 → null（getReviewOverdueRisk の責務）', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-02-01' });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).toBeNull();
  });

  it('nextReviewAt が null → null', () => {
    const sheet = makeSheet({ nextReviewAt: null });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).toBeNull();
  });

  it('archived → null', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-03-22', status: 'archived' });
    const result = getReviewApproachingRisk(sheet, TODAY);
    expect(result).toBeNull();
  });

  it('カスタム warningThresholdDays を指定可能', () => {
    // 30日閾値: 2026-03-12 → 2026-04-01 = 20日後 → 30日以内なので finding
    const sheet = makeSheet({ nextReviewAt: '2026-04-01' });
    const result = getReviewApproachingRisk(sheet, TODAY, 30);
    expect(result).not.toBeNull();
  });
});

// ═════════════════════════════════════════════
// 4. getProcedureRecordGapRisk
// ═════════════════════════════════════════════

describe('getProcedureRecordGapRisk', () => {
  it('記録なし → high finding', () => {
    const result = getProcedureRecordGapRisk(makeSheet(), [], TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('procedure_record_gap');
    expect(result!.severity).toBe('high');
  });

  it('14日以上空白 → finding', () => {
    const records = [makeRecord({ recordDate: '2026-02-20' })];
    const result = getProcedureRecordGapRisk(makeSheet(), records, TODAY);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('日間空白');
  });

  it('30日以上空白 → high', () => {
    const records = [makeRecord({ recordDate: '2026-02-01' })];
    const result = getProcedureRecordGapRisk(makeSheet(), records, TODAY);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('high');
  });

  it('13日以内の記録あり → null', () => {
    const records = [makeRecord({ recordDate: '2026-03-01' })];
    const result = getProcedureRecordGapRisk(makeSheet(), records, TODAY);
    expect(result).toBeNull();
  });

  it('カスタム閾値が効く', () => {
    const records = [makeRecord({ recordDate: '2026-03-05' })];
    const result = getProcedureRecordGapRisk(makeSheet(), records, TODAY, 5);
    expect(result).not.toBeNull();
  });

  it('archived シート → null', () => {
    const result = getProcedureRecordGapRisk(makeSheet({ status: 'archived' }), [], TODAY);
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════
// 5. getDeliveryMissingRisk
// ═════════════════════════════════════════════

describe('getDeliveryMissingRisk', () => {
  it('active + 交付なし → finding', () => {
    const sheet = makeSheet({ deliveredToUserAt: null });
    const result = getDeliveryMissingRisk(sheet, TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('delivery_missing');
  });

  it('active + 交付済み → null', () => {
    const result = getDeliveryMissingRisk(makeSheet(), TODAY);
    expect(result).toBeNull();
  });

  it('draft → null（active 以外は対象外）', () => {
    const sheet = makeSheet({ status: 'draft', deliveredToUserAt: null });
    const result = getDeliveryMissingRisk(sheet, TODAY);
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════
// 6. getAddOnCandidateFindings
// ═════════════════════════════════════════════

describe('getAddOnCandidateFindings', () => {
  it('全要件充足 → finding', () => {
    const result = getAddOnCandidateFindings(makeSheet(), makeStaffProfile(), TODAY);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('add_on_candidate');
    expect(result!.severity).toBe('low');
  });

  it('資格不足 → null', () => {
    const staff = makeStaffProfile({ hasPracticalTraining: false });
    const result = getAddOnCandidateFindings(makeSheet(), staff, TODAY);
    expect(result).toBeNull();
  });

  it('交付なし → null', () => {
    const sheet = makeSheet({ deliveredToUserAt: null });
    const result = getAddOnCandidateFindings(sheet, makeStaffProfile(), TODAY);
    expect(result).toBeNull();
  });

  it('加算なし → null', () => {
    const sheet = makeSheet({ applicableAddOnTypes: ['none'] });
    const result = getAddOnCandidateFindings(sheet, makeStaffProfile(), TODAY);
    expect(result).toBeNull();
  });

  it('draft → null', () => {
    const sheet = makeSheet({ status: 'draft' });
    const result = getAddOnCandidateFindings(sheet, makeStaffProfile(), TODAY);
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════
// buildRegulatoryFindings（統合テスト）
// ═════════════════════════════════════════════

describe('buildRegulatoryFindings', () => {
  it('全条件充足シートは加算候補 + モニタリング未実施を返す', () => {
    const input: AuditCheckInput = {
      userProfile: makeUserProfile(),
      sheets: [makeSheet()],
      staffProfiles: new Map([['S001', makeStaffProfile()]]),
      records: [makeRecord()],
      monitoringMeetings: [],
      today: TODAY,
    };
    const findings = buildRegulatoryFindings(input);
    const types = findings.map(f => f.type);
    expect(types).toContain('add_on_candidate');
    expect(types).toContain('monitoring_meeting_missing');
    expect(findings).toHaveLength(2);
  });

  it('シートなし + 対象候補 → 未作成リスク + モニタリング未実施', () => {
    const input: AuditCheckInput = {
      userProfile: makeUserProfile(),
      sheets: [],
      staffProfiles: new Map(),
      records: [],
      monitoringMeetings: [],
      today: TODAY,
    };
    const findings = buildRegulatoryFindings(input);
    const types = findings.map(f => f.type);
    expect(types).toContain('planning_sheet_missing');
    expect(types).toContain('monitoring_meeting_missing');
    expect(findings).toHaveLength(2);
  });

  it('複合リスク: 資格不足 + 期限超過 + 記録なし + 交付なし', () => {
    const sheet = makeSheet({
      authoredByStaffId: 'S002',
      nextReviewAt: '2026-01-01',
      deliveredToUserAt: null,
    });
    const staff = makeStaffProfile({ staffId: 'S002', hasPracticalTraining: false });
    const input: AuditCheckInput = {
      userProfile: makeUserProfile(),
      sheets: [sheet],
      staffProfiles: new Map([['S002', staff]]),
      records: [],
      monitoringMeetings: [],
      today: TODAY,
    };
    const findings = buildRegulatoryFindings(input);
    const types = findings.map(f => f.type);
    expect(types).toContain('author_qualification_missing');
    expect(types).toContain('review_overdue');
    expect(types).toContain('procedure_record_gap');
    expect(types).toContain('delivery_missing');
    expect(types).toContain('monitoring_meeting_missing');
    expect(types).not.toContain('add_on_candidate');
  });

  it('非対象利用者 + シートなし → 空', () => {
    const input: AuditCheckInput = {
      userProfile: makeUserProfile({ behaviorScore: 5, disabilitySupportLevel: '2' }),
      sheets: [],
      staffProfiles: new Map(),
      records: [],
      monitoringMeetings: [],
      today: TODAY,
    };
    const findings = buildRegulatoryFindings(input);
    expect(findings).toEqual([]);
  });
});

// ═════════════════════════════════════════════
// summarizeFindings
// ═════════════════════════════════════════════

describe('summarizeFindings', () => {
  it('空配列 → 全ゼロ', () => {
    const summary = summarizeFindings([]);
    expect(summary.total).toBe(0);
    expect(summary.high).toBe(0);
    expect(summary.medium).toBe(0);
    expect(summary.low).toBe(0);
  });

  it('正しく集計する', () => {
    const sheet = makeSheet({
      authoredByStaffId: 'S002',
      nextReviewAt: '2026-01-01',
      deliveredToUserAt: null,
    });
    const staff = makeStaffProfile({ staffId: 'S002', hasPracticalTraining: false });
    const input: AuditCheckInput = {
      userProfile: makeUserProfile(),
      sheets: [sheet],
      staffProfiles: new Map([['S002', staff]]),
      records: [],
      monitoringMeetings: [],
      today: TODAY,
    };
    const findings = buildRegulatoryFindings(input);
    const summary = summarizeFindings(findings);
    expect(summary.total).toBe(findings.length);
    expect(summary.high + summary.medium + summary.low).toBe(summary.total);
    expect(summary.byType.review_overdue).toBe(1);
    expect(summary.byType.procedure_record_gap).toBe(1);
  });
});
