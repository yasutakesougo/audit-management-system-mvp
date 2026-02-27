import {
    FIELD_MAP,
    USERS_SELECT_FIELDS_CORE,
    USERS_SELECT_FIELDS_DETAIL,
    USERS_SELECT_FIELDS_FULL,
    USERS_SELECT_FIELDS_SAFE,
    resolveUserSelectFields,
} from '@/sharepoint/fields';
import { describe, expect, it } from 'vitest';

// ── 必須フィールド定義（FIELD_MAP 経由で "3段整合" を CI で保証） ──

const REQUIRED_CORE_FIELDS = [
  FIELD_MAP.Users_Master.id,
  FIELD_MAP.Users_Master.fullName,
  FIELD_MAP.Users_Master.userId,
  FIELD_MAP.Users_Master.isActive,
  FIELD_MAP.Users_Master.severeFlag,
  FIELD_MAP.Users_Master.isHighIntensitySupportTarget,
  FIELD_MAP.Users_Master.attendanceDays,
];

const REQUIRED_DETAIL_FIELDS = [
  FIELD_MAP.Users_Master.usageStatus,
  FIELD_MAP.Users_Master.grantMunicipality,
  FIELD_MAP.Users_Master.grantPeriodStart,
  FIELD_MAP.Users_Master.grantPeriodEnd,
  FIELD_MAP.Users_Master.disabilitySupportLevel,
  FIELD_MAP.Users_Master.grantedDaysPerMonth,
  FIELD_MAP.Users_Master.userCopayLimit,
];

const REQUIRED_FULL_FIELDS = [
  ...REQUIRED_DETAIL_FIELDS,
  FIELD_MAP.Users_Master.transportAdditionType,
  FIELD_MAP.Users_Master.mealAddition,
  FIELD_MAP.Users_Master.copayPaymentMethod,
];

describe('Users Select Fields tiers', () => {
  // ── CORE ──
  it('CORE is a non-empty array containing essential identifiers', () => {
    expect(USERS_SELECT_FIELDS_CORE.length).toBeGreaterThan(0);
    for (const field of REQUIRED_CORE_FIELDS) {
      expect(USERS_SELECT_FIELDS_CORE).toContain(field);
    }
  });

  // ── DETAIL ──
  it('DETAIL is a strict superset of CORE', () => {
    for (const f of USERS_SELECT_FIELDS_CORE) {
      expect(USERS_SELECT_FIELDS_DETAIL).toContain(f);
    }
    expect(USERS_SELECT_FIELDS_DETAIL.length).toBeGreaterThan(USERS_SELECT_FIELDS_CORE.length);
  });

  it('DETAIL contains all support/grant decision fields', () => {
    for (const field of REQUIRED_DETAIL_FIELDS) {
      expect(USERS_SELECT_FIELDS_DETAIL).toContain(field);
    }
  });

  // ── FULL ──
  it('FULL is a strict superset of DETAIL', () => {
    for (const f of USERS_SELECT_FIELDS_DETAIL) {
      expect(USERS_SELECT_FIELDS_FULL).toContain(f);
    }
    expect(USERS_SELECT_FIELDS_FULL.length).toBeGreaterThan(USERS_SELECT_FIELDS_DETAIL.length);
  });

  it('FULL contains all billing/addon fields (silent-missing guard)', () => {
    for (const field of REQUIRED_FULL_FIELDS) {
      expect(USERS_SELECT_FIELDS_FULL).toContain(field);
    }
  });

  // ── resolver ──
  it('resolveUserSelectFields returns correct tier', () => {
    expect(resolveUserSelectFields('core')).toBe(USERS_SELECT_FIELDS_CORE);
    expect(resolveUserSelectFields('detail')).toBe(USERS_SELECT_FIELDS_DETAIL);
    expect(resolveUserSelectFields('full')).toBe(USERS_SELECT_FIELDS_FULL);
    // default = core
    expect(resolveUserSelectFields()).toBe(USERS_SELECT_FIELDS_CORE);
  });

  // ── backwards compatibility ──
  it('USERS_SELECT_FIELDS_SAFE is an alias for CORE', () => {
    expect(USERS_SELECT_FIELDS_SAFE).toBe(USERS_SELECT_FIELDS_CORE);
  });

  // ── no duplicates ──
  it('no duplicate fields in any tier', () => {
    for (const [_name, arr] of [
      ['CORE', USERS_SELECT_FIELDS_CORE],
      ['DETAIL', USERS_SELECT_FIELDS_DETAIL],
      ['FULL', USERS_SELECT_FIELDS_FULL],
    ] as const) {
      const unique = new Set(arr);
      expect(unique.size).toBe(arr.length);
    }
  });
});
