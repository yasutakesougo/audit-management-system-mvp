import { describe, expect, it } from 'vitest';
import {
    UserCoreSchema,
    UserDetailSchema,
    UserFullSchema,
} from '../../src/features/users/schema';

// ---------------------------------------------------------------------------
// Smoke tests: verify Core ⊂ Detail ⊂ Full schema hierarchy
// ---------------------------------------------------------------------------

const CORE_SAMPLE = {
  Id: 1,
  Title: null,
  UserID: 'U001',
  FullName: 'テスト 太郎',
  IsActive: true,
};

const DETAIL_SAMPLE = {
  ...CORE_SAMPLE,
  UsageStatus: '利用中',
  GrantMunicipality: '横浜市',
  GrantPeriodStart: '2025-01-01',
  GrantPeriodEnd: '2025-12-31',
  DisabilitySupportLevel: '区分3',
  GrantedDaysPerMonth: '20',
  UserCopayLimit: '9300',
};

const FULL_SAMPLE = {
  ...DETAIL_SAMPLE,
  TransportAdditionType: '往復',
  MealAddition: 'あり',
  CopayPaymentMethod: '口座振替',
  OrgCode: 'ORG001',
  OrgName: '磯子区障害者地域活動ホーム',
  Role: 'staff',
  Email: 'test@example.com',
  IsDisabled: false,
};

describe('User schema hierarchy (Core ⊂ Detail ⊂ Full)', () => {
  it('UserCoreSchema parses core-only data', () => {
    const result = UserCoreSchema.safeParse(CORE_SAMPLE);
    expect(result.success).toBe(true);
  });

  it('UserDetailSchema parses detail data', () => {
    const result = UserDetailSchema.safeParse(DETAIL_SAMPLE);
    expect(result.success).toBe(true);
  });

  it('UserFullSchema parses full data', () => {
    const result = UserFullSchema.safeParse(FULL_SAMPLE);
    expect(result.success).toBe(true);
  });

  it('UserDetailSchema accepts core-only data (detail fields are optional)', () => {
    const result = UserDetailSchema.safeParse(CORE_SAMPLE);
    expect(result.success).toBe(true);
  });

  it('UserFullSchema accepts core-only data (all extension fields are optional)', () => {
    const result = UserFullSchema.safeParse(CORE_SAMPLE);
    expect(result.success).toBe(true);
  });

  it('UserCoreSchema rejects missing required fields', () => {
    const result = UserCoreSchema.safeParse({ Id: 1 }); // missing UserID, FullName, Title
    expect(result.success).toBe(false);
  });
});
