/**
 * 制度判定ドメイン — ユニットテスト
 *
 * テスト観点:
 *   - UserRegulatoryProfile: behaviorScore 境界値、serviceTypes 配列、対象判定ロジック
 *   - StaffQualificationProfile: bool フラグ、最高資格判定、作成要件判定
 *   - isSevereBehaviorSupportCandidate: 境界条件
 *   - resolveHighestQualification: 優先順位
 *   - meetsAuthoringRequirement: 条件判定
 */
import { describe, it, expect } from 'vitest';

import {
  userRegulatoryProfileSchema,
  isSevereBehaviorSupportCandidate,
  USER_REGULATORY_FIELD_MAP,
  staffQualificationProfileSchema,
  resolveHighestQualification,
  meetsAuthoringRequirement,
  meetsConfirmationRequirement,
  checkSPSConfirmationEligibility,
  STAFF_REGULATORY_FIELD_MAP,
} from '@/domain/regulatory';

// ═════════════════════════════════════════════
// UserRegulatoryProfile
// ═════════════════════════════════════════════

describe('userRegulatoryProfileSchema', () => {
  it('正常な制度プロファイルを受理する', () => {
    const result = userRegulatoryProfileSchema.safeParse({
      userId: 'U001',
      behaviorScore: 14,
      childBehaviorScore: null,
      disabilitySupportLevel: '4',
      serviceTypes: ['daily_life_care', 'short_stay'],
      severeBehaviorSupportEligible: true,
      eligibilityCheckedAt: '2026-03-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.behaviorScore).toBe(14);
      expect(result.data.serviceTypes).toHaveLength(2);
    }
  });

  it('デフォルト値が正しく設定される', () => {
    const result = userRegulatoryProfileSchema.parse({ userId: 'U001' });
    expect(result.behaviorScore).toBeNull();
    expect(result.childBehaviorScore).toBeNull();
    expect(result.disabilitySupportLevel).toBeNull();
    expect(result.serviceTypes).toEqual([]);
    expect(result.severeBehaviorSupportEligible).toBe(false);
    expect(result.eligibilityCheckedAt).toBeNull();
  });

  it('userId が空で失敗する', () => {
    const result = userRegulatoryProfileSchema.safeParse({ userId: '' });
    expect(result.success).toBe(false);
  });

  describe('behaviorScore 境界値', () => {
    it('0 を受理する', () => {
      const result = userRegulatoryProfileSchema.safeParse({ userId: 'U001', behaviorScore: 0 });
      expect(result.success).toBe(true);
    });

    it('24 を受理する', () => {
      const result = userRegulatoryProfileSchema.safeParse({ userId: 'U001', behaviorScore: 24 });
      expect(result.success).toBe(true);
    });

    it('-1 を拒否する', () => {
      const result = userRegulatoryProfileSchema.safeParse({ userId: 'U001', behaviorScore: -1 });
      expect(result.success).toBe(false);
    });

    it('25 を拒否する', () => {
      const result = userRegulatoryProfileSchema.safeParse({ userId: 'U001', behaviorScore: 25 });
      expect(result.success).toBe(false);
    });

    it('null を受理する', () => {
      const result = userRegulatoryProfileSchema.safeParse({ userId: 'U001', behaviorScore: null });
      expect(result.success).toBe(true);
    });
  });

  describe('serviceTypes バリデーション', () => {
    it('有効なサービス種別の配列を受理する', () => {
      const result = userRegulatoryProfileSchema.safeParse({
        userId: 'U001',
        serviceTypes: ['daily_life_care', 'behavior_support'],
      });
      expect(result.success).toBe(true);
    });

    it('不正なサービス種別を拒否する', () => {
      const result = userRegulatoryProfileSchema.safeParse({
        userId: 'U001',
        serviceTypes: ['invalid_service'],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════
// isSevereBehaviorSupportCandidate
// ═════════════════════════════════════════════

describe('isSevereBehaviorSupportCandidate', () => {
  it('score≥10 & level≥4 → true', () => {
    expect(isSevereBehaviorSupportCandidate(10, '4')).toBe(true);
    expect(isSevereBehaviorSupportCandidate(14, '5')).toBe(true);
    expect(isSevereBehaviorSupportCandidate(24, '6')).toBe(true);
  });

  it('score<10 → false', () => {
    expect(isSevereBehaviorSupportCandidate(9, '4')).toBe(false);
    expect(isSevereBehaviorSupportCandidate(0, '6')).toBe(false);
  });

  it('level<4 → false', () => {
    expect(isSevereBehaviorSupportCandidate(14, '3')).toBe(false);
    expect(isSevereBehaviorSupportCandidate(14, '1')).toBe(false);
  });

  it('null score → false', () => {
    expect(isSevereBehaviorSupportCandidate(null, '4')).toBe(false);
    expect(isSevereBehaviorSupportCandidate(undefined, '4')).toBe(false);
  });

  it('null level → false', () => {
    expect(isSevereBehaviorSupportCandidate(14, null)).toBe(false);
    expect(isSevereBehaviorSupportCandidate(14, undefined)).toBe(false);
  });

  it('不正な level 文字列 → false', () => {
    expect(isSevereBehaviorSupportCandidate(14, 'abc')).toBe(false);
    expect(isSevereBehaviorSupportCandidate(14, '')).toBe(false);
  });
});

// ═════════════════════════════════════════════
// USER_REGULATORY_FIELD_MAP
// ═════════════════════════════════════════════

describe('USER_REGULATORY_FIELD_MAP', () => {
  it('既存列の再利用が正しい', () => {
    expect(USER_REGULATORY_FIELD_MAP.severeBehaviorSupportEligible).toBe('IsHighIntensitySupportTarget');
    expect(USER_REGULATORY_FIELD_MAP.disabilitySupportLevel).toBe('DisabilitySupportLevel');
  });

  it('新設列が定義されている', () => {
    expect(USER_REGULATORY_FIELD_MAP.behaviorScore).toBe('BehaviorScore');
    expect(USER_REGULATORY_FIELD_MAP.childBehaviorScore).toBe('ChildBehaviorScore');
    expect(USER_REGULATORY_FIELD_MAP.serviceTypesJson).toBe('ServiceTypesJson');
    expect(USER_REGULATORY_FIELD_MAP.eligibilityCheckedAt).toBe('EligibilityCheckedAt');
  });
});

// ═════════════════════════════════════════════
// StaffQualificationProfile
// ═════════════════════════════════════════════

describe('staffQualificationProfileSchema', () => {
  it('正常な資格プロファイルを受理する', () => {
    const result = staffQualificationProfileSchema.safeParse({
      staffId: 'S001',
      hasPracticalTraining: true,
      hasBasicTraining: true,
      hasBehaviorGuidanceTraining: false,
      hasCorePersonTraining: false,
      certificationCheckedAt: '2026-03-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasPracticalTraining).toBe(true);
      expect(result.data.hasBasicTraining).toBe(true);
    }
  });

  it('デフォルト値が正しく設定される', () => {
    const result = staffQualificationProfileSchema.parse({ staffId: 'S001' });
    expect(result.hasPracticalTraining).toBe(false);
    expect(result.hasBasicTraining).toBe(false);
    expect(result.hasBehaviorGuidanceTraining).toBe(false);
    expect(result.hasCorePersonTraining).toBe(false);
    expect(result.certificationCheckedAt).toBeNull();
  });

  it('staffId が空で失敗する', () => {
    const result = staffQualificationProfileSchema.safeParse({ staffId: '' });
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════
// resolveHighestQualification
// ═════════════════════════════════════════════

describe('resolveHighestQualification', () => {
  const base = { staffId: 'S001', hasPracticalTraining: false, hasBasicTraining: false, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: null };

  it('全 false → unknown', () => {
    expect(resolveHighestQualification(base)).toBe('unknown');
  });

  it('basic のみ → basic_training', () => {
    expect(resolveHighestQualification({ ...base, hasBasicTraining: true })).toBe('basic_training');
  });

  it('behavior_guidance のみ → behavior_guidance_training', () => {
    expect(resolveHighestQualification({ ...base, hasBehaviorGuidanceTraining: true })).toBe('behavior_guidance_training');
  });

  it('practical のみ → practical_training', () => {
    expect(resolveHighestQualification({ ...base, hasPracticalTraining: true })).toBe('practical_training');
  });

  it('core_person → core_person_training（最高優先）', () => {
    expect(resolveHighestQualification({ ...base, hasCorePersonTraining: true, hasPracticalTraining: true })).toBe('core_person_training');
  });

  it('practical + basic → practical_training が優先', () => {
    expect(resolveHighestQualification({ ...base, hasPracticalTraining: true, hasBasicTraining: true })).toBe('practical_training');
  });
});

// ═════════════════════════════════════════════
// meetsAuthoringRequirement
// ═════════════════════════════════════════════

describe('meetsAuthoringRequirement', () => {
  const base = { staffId: 'S001', hasPracticalTraining: false, hasBasicTraining: false, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: null };

  it('practical のみ → true', () => {
    expect(meetsAuthoringRequirement({ ...base, hasPracticalTraining: true })).toBe(true);
  });

  it('core_person のみ → true', () => {
    expect(meetsAuthoringRequirement({ ...base, hasCorePersonTraining: true })).toBe(true);
  });

  it('basic のみ → false', () => {
    expect(meetsAuthoringRequirement({ ...base, hasBasicTraining: true })).toBe(false);
  });

  it('behavior_guidance のみ → false', () => {
    expect(meetsAuthoringRequirement({ ...base, hasBehaviorGuidanceTraining: true })).toBe(false);
  });

  it('全 false → false', () => {
    expect(meetsAuthoringRequirement(base)).toBe(false);
  });
});

// ═════════════════════════════════════════════
// meetsConfirmationRequirement
// ═════════════════════════════════════════════

describe('meetsConfirmationRequirement', () => {
  const base = { staffId: 'S001', hasPracticalTraining: false, hasBasicTraining: false, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: null };

  it('practical のみ → true', () => {
    expect(meetsConfirmationRequirement({ ...base, hasPracticalTraining: true })).toBe(true);
  });

  it('core_person のみ → true', () => {
    expect(meetsConfirmationRequirement({ ...base, hasCorePersonTraining: true })).toBe(true);
  });

  it('basic のみ → false', () => {
    expect(meetsConfirmationRequirement({ ...base, hasBasicTraining: true })).toBe(false);
  });

  it('全 false → false', () => {
    expect(meetsConfirmationRequirement(base)).toBe(false);
  });
});

// ═════════════════════════════════════════════
// checkSPSConfirmationEligibility
// ═════════════════════════════════════════════

describe('checkSPSConfirmationEligibility', () => {
  const base = { staffId: 'S001', hasPracticalTraining: false, hasBasicTraining: false, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: null };

  it('practical 修了 → eligible', () => {
    const result = checkSPSConfirmationEligibility({ ...base, hasPracticalTraining: true });
    expect(result.eligible).toBe(true);
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.missingQualifications).toHaveLength(0);
  });

  it('core_person 修了 → eligible', () => {
    const result = checkSPSConfirmationEligibility({ ...base, hasCorePersonTraining: true });
    expect(result.eligible).toBe(true);
  });

  it('両方修了 → eligible', () => {
    const result = checkSPSConfirmationEligibility({ ...base, hasPracticalTraining: true, hasCorePersonTraining: true });
    expect(result.eligible).toBe(true);
  });

  it('basic のみ → not eligible + 不足資格が列挙される', () => {
    const result = checkSPSConfirmationEligibility({ ...base, hasBasicTraining: true });
    expect(result.eligible).toBe(false);
    expect(result.reasonCodes).toContain('no_practical_training');
    expect(result.reasonCodes).toContain('no_core_person_training');
    expect(result.missingQualifications).toHaveLength(2);
  });

  it('全 false → not eligible + 全不足', () => {
    const result = checkSPSConfirmationEligibility(base);
    expect(result.eligible).toBe(false);
    expect(result.reasonCodes).toContain('no_practical_training');
    expect(result.reasonCodes).toContain('no_core_person_training');
  });

  it('不足資格に日本語ラベルが含まれる', () => {
    const result = checkSPSConfirmationEligibility(base);
    expect(result.missingQualifications).toContain('強度行動障害支援者養成研修（実践研修）');
    expect(result.missingQualifications).toContain('中核的人材養成研修');
  });
});

// ═════════════════════════════════════════════
// STAFF_REGULATORY_FIELD_MAP
// ═════════════════════════════════════════════

describe('STAFF_REGULATORY_FIELD_MAP', () => {
  it('新設列が定義されている', () => {
    expect(STAFF_REGULATORY_FIELD_MAP.hasPracticalTraining).toBe('HasPracticalTraining');
    expect(STAFF_REGULATORY_FIELD_MAP.hasBasicTraining).toBe('HasBasicTraining');
    expect(STAFF_REGULATORY_FIELD_MAP.hasBehaviorGuidanceTraining).toBe('HasBehaviorGuidanceTraining');
    expect(STAFF_REGULATORY_FIELD_MAP.hasCorePersonTraining).toBe('HasCorePersonTraining');
    expect(STAFF_REGULATORY_FIELD_MAP.certificationCheckedAt).toBe('CertificationCheckedAt');
  });
});
