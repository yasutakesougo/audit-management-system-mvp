import { describe, expect, it } from 'vitest';

import {
  USER_BENEFIT_PROFILE_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
  USER_TRANSPORT_SETTINGS_CANDIDATES,
} from '@/sharepoint/fields';

import { CutoverStage } from '../../migration/userBenefitProfileCutover/stage';
import type { IUserMaster } from '../../../types';
import { UserJoiner } from '../UserJoiner';
import {
  buildAccessorySelect,
  groupRowsByUserId,
  joinUsersWithAccessoryMaps,
  type AccessoryListContext,
} from '../userBulkJoin';

const makeUser = (id: number, userId: string): IUserMaster =>
  ({
    Id: id,
    Title: null,
    UserID: userId,
    FullName: `User-${userId}`,
    Furigana: null,
    FullNameKana: null,
    ContractDate: null,
    ServiceStartDate: null,
    ServiceEndDate: null,
    IsHighIntensitySupportTarget: null,
    IsSupportProcedureTarget: null,
    severeFlag: null,
    IsActive: true,
    TransportToDays: [],
    TransportFromDays: [],
    TransportCourse: null,
    TransportSchedule: null,
    AttendanceDays: [],
    RecipientCertNumber: null,
    RecipientCertExpiry: null,
    Modified: null,
    Created: null,
    UsageStatus: null,
    GrantMunicipality: null,
    GrantPeriodStart: null,
    GrantPeriodEnd: null,
    DisabilitySupportLevel: null,
    GrantedDaysPerMonth: null,
    UserCopayLimit: null,
    TransportAdditionType: null,
    MealAddition: null,
    CopayPaymentMethod: null,
    LastAssessmentDate: null,
    BehaviorScore: null,
    ChildBehaviorScore: null,
    ServiceTypesJson: null,
    EligibilityCheckedAt: null,
    __selectMode: 'detail',
  }) as unknown as IUserMaster;

describe('groupRowsByUserId', () => {
  it('keys rows by the join field value', () => {
    const rows = [
      { UserID: 'U-001', TransportCourse: 'A' },
      { UserID: 'U-002', TransportCourse: 'B' },
    ];
    const map = groupRowsByUserId(rows, 'UserID');

    expect(map.size).toBe(2);
    expect(map.get('U-001')?.TransportCourse).toBe('A');
    expect(map.get('U-002')?.TransportCourse).toBe('B');
  });

  it('keeps the first row when duplicates exist (matches top:1 semantics)', () => {
    const rows = [
      { UserID: 'U-001', TransportCourse: 'first' },
      { UserID: 'U-001', TransportCourse: 'second' },
    ];
    const map = groupRowsByUserId(rows, 'UserID');

    expect(map.get('U-001')?.TransportCourse).toBe('first');
  });

  it('skips rows with missing or non-string join value', () => {
    const rows = [
      { UserID: '', TransportCourse: 'empty' },
      { UserID: null as unknown as string, TransportCourse: 'null' },
      { UserID: 'U-002', TransportCourse: 'real' },
    ];
    const map = groupRowsByUserId(rows, 'UserID');

    expect(map.size).toBe(1);
    expect(map.get('U-002')?.TransportCourse).toBe('real');
  });

  it('respects a drifted join field name', () => {
    const rows = [{ UserID0: 'U-007', TransportCourse: 'X' }];
    const map = groupRowsByUserId(rows, 'UserID0');

    expect(map.get('U-007')?.TransportCourse).toBe('X');
  });
});

describe('buildAccessorySelect', () => {
  it('returns Id plus resolved physical names, deduped', () => {
    const select = buildAccessorySelect({
      userId: 'UserID',
      transportCourse: 'TransportCourse',
      transportSchedule: undefined,
    });
    expect(select).toContain('Id');
    expect(select).toContain('UserID');
    expect(select).toContain('TransportCourse');
    expect(select).not.toContain(undefined);
    expect(new Set(select).size).toBe(select.length);
  });

  it('always returns Id even when no fields resolved', () => {
    expect(buildAccessorySelect({})).toEqual(['Id']);
  });
});

describe('joinUsersWithAccessoryMaps', () => {
  const buildContext = (
    transportRows: Array<Record<string, unknown>>,
    benefitRows: Array<Record<string, unknown>>,
    benefitExtRows: Array<Record<string, unknown>>,
  ) => {
    const transport: AccessoryListContext = {
      map: groupRowsByUserId(transportRows, 'UserID'),
      candidates: USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>,
      resolved: { userId: 'UserID', transportCourse: 'TransportCourse', transportSchedule: 'TransportSchedule' },
    };
    const benefit: AccessoryListContext = {
      map: groupRowsByUserId(benefitRows, 'UserID'),
      candidates: USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>,
      resolved: { userId: 'UserID', recipientCertExpiry: 'RecipientCertExpiry', grantMunicipality: 'GrantMunicipality' },
    };
    const benefitExt: AccessoryListContext = {
      map: groupRowsByUserId(benefitExtRows, 'UserID'),
      candidates: USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>,
      resolved: { userId: 'UserID', recipientCertNumber: 'RecipientCertNumber' },
    };
    return {
      transport,
      benefit,
      benefitExt,
      joiner: new UserJoiner(),
      benefitCutoverStage: CutoverStage.WRITE_CUTOVER,
    };
  };

  it('merges accessory data by UserID', () => {
    const users = [makeUser(1, 'U-001'), makeUser(2, 'U-002')];
    const context = buildContext(
      [{ UserID: 'U-001', TransportCourse: 'Course-A' }],
      [{ UserID: 'U-002', RecipientCertExpiry: '2026-12-31', GrantMunicipality: 'Tokyo' }],
      [{ UserID: 'U-001', RecipientCertNumber: 'BEN-001' }],
    );

    const enriched = joinUsersWithAccessoryMaps(users, context);

    expect(enriched).toHaveLength(2);
    expect(enriched[0].TransportCourse).toBe('Course-A');
    expect(enriched[0].RecipientCertNumber).toBe('BEN-001');
    expect(enriched[0].GrantMunicipality).toBeNull();
    expect(enriched[1].RecipientCertExpiry).toBe('2026-12-31');
    expect(enriched[1].GrantMunicipality).toBe('Tokyo');
    expect(enriched[1].TransportCourse).toBeNull();
  });

  it('returns users unchanged when no accessory rows match', () => {
    const users = [makeUser(1, 'U-999')];
    const context = buildContext([], [], []);

    const enriched = joinUsersWithAccessoryMaps(users, context);

    expect(enriched[0]).toEqual(users[0]);
  });

  it('skips enrichment for users with empty UserID', () => {
    const user = { ...makeUser(1, ''), UserID: '' } as IUserMaster;
    const context = buildContext(
      [{ UserID: '', TransportCourse: 'never-merged' }],
      [],
      [],
    );

    const enriched = joinUsersWithAccessoryMaps([user], context);

    expect(enriched[0].TransportCourse).toBeNull();
  });

  it('preserves input array length and order', () => {
    const users = [makeUser(1, 'U-001'), makeUser(2, 'U-002'), makeUser(3, 'U-003')];
    const context = buildContext(
      [{ UserID: 'U-002', TransportCourse: 'mid' }],
      [],
      [],
    );

    const enriched = joinUsersWithAccessoryMaps(users, context);

    expect(enriched.map((u) => u.UserID)).toEqual(['U-001', 'U-002', 'U-003']);
    expect(enriched[1].TransportCourse).toBe('mid');
  });
});
