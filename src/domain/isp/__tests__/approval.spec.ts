/**
 * ISP 承認フロー — ユニットテスト
 *
 * F-1: approvedBy / approvedAt / approvalStatus のドメインロジック検証
 *
 * テスト対象:
 *   - approveIsp() — 承認 pure function
 *   - canApproveIsp() — guard function
 *   - ispApprovalSchema — デフォルト値
 */

import { describe, it, expect } from 'vitest';
import {
  approveIsp,
  canApproveIsp,
  ispApprovalSchema,
  ispComplianceMetadataSchema,
  type IndividualSupportPlan,
  type ApproveIspInput,
} from '../schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestPlan(
  overrides: Partial<IndividualSupportPlan> = {},
): IndividualSupportPlan {
  return {
    id: 'isp-001',
    createdAt: '2026-03-01T00:00:00Z',
    createdBy: 'user@example.com',
    updatedAt: '2026-03-01T00:00:00Z',
    updatedBy: 'user@example.com',
    version: 1,
    userId: 'U001',
    title: 'テスト計画',
    planStartDate: '2026-04-01',
    planEndDate: '2027-03-31',
    userIntent: '自立した生活',
    familyIntent: '',
    overallSupportPolicy: '本人意向に沿った支援',
    qolIssues: '',
    longTermGoals: ['目標A'],
    shortTermGoals: ['目標B'],
    supportSummary: '',
    precautions: '',
    consentAt: null,
    deliveredAt: null,
    monitoringSummary: '',
    lastMonitoringAt: null,
    nextReviewAt: null,
    status: 'consent_pending',
    isCurrent: true,
    compliance: ispComplianceMetadataSchema.parse({}),
    ...overrides,
  };
}

const APPROVER_INPUT: ApproveIspInput = {
  approverUpn: 'sabikan@example.com',
  approvedAt: '2026-03-14T12:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ispApprovalSchema', () => {
  it('デフォルト値が draft ステータスで null フィールド', () => {
    const result = ispApprovalSchema.parse({});
    expect(result).toEqual({
      approvedBy: null,
      approvedAt: null,
      approvalStatus: 'draft',
    });
  });

  it('approved ステータスと承認者情報を受け入れる', () => {
    const result = ispApprovalSchema.parse({
      approvedBy: 'sabikan@example.com',
      approvedAt: '2026-03-14T12:00:00Z',
      approvalStatus: 'approved',
    });
    expect(result.approvalStatus).toBe('approved');
    expect(result.approvedBy).toBe('sabikan@example.com');
  });
});

describe('canApproveIsp', () => {
  it('consent_pending かつ未承認の ISP は承認可能', () => {
    const plan = createTestPlan({ status: 'consent_pending' });
    expect(canApproveIsp(plan)).toBe(true);
  });

  it.each([
    'assessment',
    'proposal',
    'meeting',
    'active',
    'monitoring',
    'revision',
    'closed',
  ] as const)('status=%s では承認不可', (status) => {
    const plan = createTestPlan({ status });
    expect(canApproveIsp(plan)).toBe(false);
  });

  it('すでに approved の ISP は再承認不可', () => {
    const plan = createTestPlan({
      status: 'consent_pending',
      compliance: {
        ...ispComplianceMetadataSchema.parse({}),
        approval: {
          approvedBy: 'other@example.com',
          approvedAt: '2026-03-10T00:00:00Z',
          approvalStatus: 'approved',
        },
      },
    });
    expect(canApproveIsp(plan)).toBe(false);
  });

  it('compliance が undefined でも consent_pending なら承認可能', () => {
    const plan = createTestPlan({
      status: 'consent_pending',
      compliance: undefined,
    });
    expect(canApproveIsp(plan)).toBe(true);
  });
});

describe('approveIsp', () => {
  it('consent_pending の ISP を承認できる', () => {
    const plan = createTestPlan({ status: 'consent_pending' });
    const result = approveIsp(plan, APPROVER_INPUT);

    expect(result.compliance?.approval).toEqual({
      approvedBy: 'sabikan@example.com',
      approvedAt: '2026-03-14T12:00:00Z',
      approvalStatus: 'approved',
    });
  });

  it('元のプランを変更しないイミュータブル性', () => {
    const plan = createTestPlan({ status: 'consent_pending' });
    const result = approveIsp(plan, APPROVER_INPUT);

    // 元のプランは変わらない
    expect(plan.compliance?.approval?.approvalStatus).toBe('draft');
    // 新しいプランは承認済み
    expect(result.compliance?.approval?.approvalStatus).toBe('approved');
    // 参照が異なる
    expect(result).not.toBe(plan);
  });

  it('元の compliance フィールドを保持する', () => {
    const plan = createTestPlan({
      status: 'consent_pending',
      compliance: {
        ...ispComplianceMetadataSchema.parse({}),
        serviceType: 'daily_life_care',
        standardServiceHours: 6.5,
      },
    });
    const result = approveIsp(plan, APPROVER_INPUT);

    expect(result.compliance?.serviceType).toBe('daily_life_care');
    expect(result.compliance?.standardServiceHours).toBe(6.5);
    expect(result.compliance?.approval?.approvalStatus).toBe('approved');
  });

  it('compliance が undefined の ISP でも承認可能', () => {
    const plan = createTestPlan({
      status: 'consent_pending',
      compliance: undefined,
    });
    const result = approveIsp(plan, APPROVER_INPUT);

    expect(result.compliance?.approval?.approvalStatus).toBe('approved');
    expect(result.compliance?.serviceType).toBe('other'); // デフォルト値
  });

  it('assessment ステータスでは Error を throw する', () => {
    const plan = createTestPlan({ status: 'assessment' });
    expect(() => approveIsp(plan, APPROVER_INPUT)).toThrow(
      'ISP を承認できません',
    );
  });

  it('すでに approved の ISP では Error を throw する', () => {
    const plan = createTestPlan({
      status: 'consent_pending',
      compliance: {
        ...ispComplianceMetadataSchema.parse({}),
        approval: {
          approvedBy: 'other@example.com',
          approvedAt: '2026-03-10T00:00:00Z',
          approvalStatus: 'approved',
        },
      },
    });
    expect(() => approveIsp(plan, APPROVER_INPUT)).toThrow(
      'ISP を承認できません',
    );
  });
});
