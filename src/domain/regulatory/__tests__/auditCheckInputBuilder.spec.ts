/**
 * auditCheckInputBuilder テスト
 *
 * IUserMaster / Staff / PlanningSheetListItem → AuditCheckInput 変換の
 * 境界値・パース・統合を検証する。
 */

import { describe, it, expect } from 'vitest';
import {
  toUserRegulatoryProfile,
  toStaffQualificationProfile,
  buildStaffProfilesMap,
  toSheetAuditInfo,
  toRecordAuditInfo,
  buildAllAuditCheckInputs,
} from '../auditCheckInputBuilder';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { PlanningSheetListItem } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// ファクトリ
// ─────────────────────────────────────────────

function makeUser(overrides: Partial<IUserMaster> = {}): IUserMaster {
  return {
    Id: 1,
    UserID: 'U001',
    FullName: 'テスト太郎',
    IsActive: true,
    BehaviorScore: 14,
    DisabilitySupportLevel: '4',
    IsHighIntensitySupportTarget: true,
    ...overrides,
  };
}

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 1,
    staffId: 'S001',
    name: 'スタッフA',
    certifications: [],
    workDays: [],
    baseWorkingDays: [],
    active: true,
    ...overrides,
  };
}

function makeSheet(overrides: Partial<PlanningSheetListItem> = {}): PlanningSheetListItem {
  return {
    id: 'sheet-1',
    userId: 'U001',
    ispId: 'isp-1',
    title: '食事支援',
    targetScene: null,
    status: 'active',
    nextReviewAt: '2026-07-01',
    isCurrent: true,
    applicableServiceType: 'daily_life_care',
    applicableAddOnTypes: ['severe_disability_support'],
    authoredByQualification: 'practical_training',
    reviewedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// toUserRegulatoryProfile
// ─────────────────────────────────────────────

describe('toUserRegulatoryProfile', () => {
  it('基本フィールドを正しく変換する', () => {
    const result = toUserRegulatoryProfile(makeUser());
    expect(result.userId).toBe('U001');
    expect(result.behaviorScore).toBe(14);
    expect(result.disabilitySupportLevel).toBe('4');
    expect(result.severeBehaviorSupportEligible).toBe(true);
  });

  it('BehaviorScore が null なら null を返す', () => {
    const result = toUserRegulatoryProfile(makeUser({ BehaviorScore: null }));
    expect(result.behaviorScore).toBeNull();
  });

  it('ServiceTypesJson を正しくパースする', () => {
    const result = toUserRegulatoryProfile(
      makeUser({ ServiceTypesJson: '["daily_life_care","group_home"]' }),
    );
    expect(result.serviceTypes).toEqual(['daily_life_care', 'group_home']);
  });

  it('ServiceTypesJson が不正な JSON なら空配列を返す', () => {
    const result = toUserRegulatoryProfile(
      makeUser({ ServiceTypesJson: 'invalid-json' }),
    );
    expect(result.serviceTypes).toEqual([]);
  });

  it('ServiceTypesJson が null なら空配列を返す', () => {
    const result = toUserRegulatoryProfile(
      makeUser({ ServiceTypesJson: null }),
    );
    expect(result.serviceTypes).toEqual([]);
  });

  it('UserID が未定義なら fallback ID を使う', () => {
    // UserID は string 必須だが、念のため
    const result = toUserRegulatoryProfile({
      ...makeUser(),
      UserID: undefined as unknown as string,
    });
    expect(result.userId).toBe('user-1');
  });
});

// ─────────────────────────────────────────────
// toStaffQualificationProfile
// ─────────────────────────────────────────────

describe('toStaffQualificationProfile', () => {
  it('資格がない場合、全フラグが false になる', () => {
    const result = toStaffQualificationProfile(makeStaff());
    expect(result.hasPracticalTraining).toBe(false);
    expect(result.hasBasicTraining).toBe(false);
    expect(result.hasBehaviorGuidanceTraining).toBe(false);
    expect(result.hasCorePersonTraining).toBe(false);
  });

  it('実践研修修了を検出する', () => {
    const result = toStaffQualificationProfile(
      makeStaff({ certifications: ['強度行動障害支援者養成研修（実践研修）'] }),
    );
    expect(result.hasPracticalTraining).toBe(true);
    expect(result.hasBasicTraining).toBe(false);
  });

  it('基礎研修修了を検出する', () => {
    const result = toStaffQualificationProfile(
      makeStaff({ certifications: ['強度行動障害支援者養成研修（基礎研修）'] }),
    );
    expect(result.hasBasicTraining).toBe(true);
  });

  it('行動援護研修修了を検出する', () => {
    const result = toStaffQualificationProfile(
      makeStaff({ certifications: ['行動援護従業者養成研修'] }),
    );
    expect(result.hasBehaviorGuidanceTraining).toBe(true);
  });

  it('中核的人材養成研修修了を検出する', () => {
    const result = toStaffQualificationProfile(
      makeStaff({ certifications: ['中核的人材養成研修'] }),
    );
    expect(result.hasCorePersonTraining).toBe(true);
  });
});

// ─────────────────────────────────────────────
// buildStaffProfilesMap
// ─────────────────────────────────────────────

describe('buildStaffProfilesMap', () => {
  it('active な職員のみ含む', () => {
    const map = buildStaffProfilesMap([
      makeStaff({ staffId: 'S001', active: true }),
      makeStaff({ staffId: 'S002', active: false }),
    ]);
    expect(map.size).toBe(1);
    expect(map.has('S001')).toBe(true);
    expect(map.has('S002')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// toSheetAuditInfo
// ─────────────────────────────────────────────

describe('toSheetAuditInfo', () => {
  it('フィールドを正しく変換する', () => {
    const result = toSheetAuditInfo(makeSheet());
    expect(result.id).toBe('sheet-1');
    expect(result.userId).toBe('U001');
    expect(result.title).toBe('食事支援');
    expect(result.status).toBe('active');
    expect(result.isCurrent).toBe(true);
    expect(result.nextReviewAt).toBe('2026-07-01');
    expect(result.applicableAddOnTypes).toEqual(['severe_disability_support']);
  });
});

// ─────────────────────────────────────────────
// toRecordAuditInfo
// ─────────────────────────────────────────────

describe('toRecordAuditInfo', () => {
  it('フィールドを正しく変換する', () => {
    const result = toRecordAuditInfo({
      id: 'rec-1',
      planningSheetId: 'sheet-1',
      recordDate: '2026-03-10',
    });
    expect(result.id).toBe('rec-1');
    expect(result.planningSheetId).toBe('sheet-1');
    expect(result.recordDate).toBe('2026-03-10');
  });
});

// ─────────────────────────────────────────────
// buildAllAuditCheckInputs
// ─────────────────────────────────────────────

describe('buildAllAuditCheckInputs', () => {
  it('利用者ごとに AuditCheckInput を生成する', () => {
    const users = [makeUser({ UserID: 'U001' }), makeUser({ Id: 2, UserID: 'U002' })];
    const staff = [makeStaff({ staffId: 'S001' })];
    const sheetsByUser = new Map([
      ['U001', [makeSheet({ id: 'sheet-1', userId: 'U001' })]],
    ]);
    const recordsBySheet = new Map<string, { id: string; planningSheetId: string; recordDate: string }[]>([
      ['sheet-1', [{ id: 'rec-1', planningSheetId: 'sheet-1', recordDate: '2026-03-10' }]],
    ]);

    const inputs = buildAllAuditCheckInputs(
      { users, staff, sheetsByUser, recordsBySheet, monitoringMeetingsByUser: new Map() },
      '2026-03-14',
    );

    expect(inputs).toHaveLength(2);

    // U001: シートあり、記録あり
    expect(inputs[0].userProfile.userId).toBe('U001');
    expect(inputs[0].sheets).toHaveLength(1);
    expect(inputs[0].records).toHaveLength(1);
    expect(inputs[0].today).toBe('2026-03-14');

    // U002: シートなし、記録なし
    expect(inputs[1].userProfile.userId).toBe('U002');
    expect(inputs[1].sheets).toHaveLength(0);
    expect(inputs[1].records).toHaveLength(0);
  });

  it('IsActive=false の利用者はスキップする', () => {
    const users = [
      makeUser({ UserID: 'U001', IsActive: true }),
      makeUser({ Id: 2, UserID: 'U002', IsActive: false }),
    ];

    const inputs = buildAllAuditCheckInputs(
      { users, staff: [], sheetsByUser: new Map(), recordsBySheet: new Map(), monitoringMeetingsByUser: new Map() },
      '2026-03-14',
    );

    expect(inputs).toHaveLength(1);
    expect(inputs[0].userProfile.userId).toBe('U001');
  });

  it('staffProfiles は全 input で共有される', () => {
    const users = [makeUser({ UserID: 'U001' }), makeUser({ Id: 2, UserID: 'U002' })];
    const staff = [
      makeStaff({ staffId: 'S001', certifications: ['実践研修'] }),
      makeStaff({ staffId: 'S002', certifications: ['基礎研修'] }),
    ];

    const inputs = buildAllAuditCheckInputs(
      { users, staff, sheetsByUser: new Map(), recordsBySheet: new Map(), monitoringMeetingsByUser: new Map() },
      '2026-03-14',
    );

    // 同じ Map を参照
    expect(inputs[0].staffProfiles).toBe(inputs[1].staffProfiles);
    expect(inputs[0].staffProfiles.size).toBe(2);
  });
});
