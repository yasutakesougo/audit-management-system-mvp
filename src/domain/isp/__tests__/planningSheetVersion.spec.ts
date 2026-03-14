// ---------------------------------------------------------------------------
// planningSheetVersion.spec.ts — P2 版管理のドメインロジックテスト
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import type { SupportPlanningSheet } from '../schema';

import {
  computeDaysOverdue,
  isReviewOverdue,
  computeReviewAlertLevel,
  createRevisionDraft,
  activatePlanningSheetVersion,
  archivePlanningSheetVersion,
  getPlanningSheetVersionHistory,
  toVersionHistoryEntries,
  computeVersionSummary,
  getCurrentVersion,
  getLatestVersion,
  sortByVersionDescFull,
} from '../planningSheetVersion';

// ---------------------------------------------------------------------------
// Helper: テスト用の SupportPlanningSheet を最小構成で作成
// ---------------------------------------------------------------------------

function makeSheet(
  overrides: Partial<SupportPlanningSheet> = {},
): SupportPlanningSheet {
  return {
    id: 'ps-001',
    userId: 'U001',
    ispId: 'ISP-001',
    title: '支援計画シート v1',
    targetScene: '',
    targetDomain: '',
    observationFacts: '行動観察データ',
    collectedInformation: '',
    interpretationHypothesis: '仮説',
    supportIssues: '課題',
    supportPolicy: '方針',
    environmentalAdjustments: '',
    concreteApproaches: '具体策',
    appliedFrom: '2026-01-01',
    nextReviewAt: '2026-06-30',
    authoredByStaffId: 'S001',
    authoredByQualification: 'practical_training',
    authoredAt: '2026-01-01T00:00:00Z',
    applicableServiceType: 'daily_life_care',
    applicableAddOnTypes: ['severe_disability_support'],
    deliveredToUserAt: null,
    reviewedAt: null,
    hasMedicalCoordination: false,
    hasEducationCoordination: false,
    supportStartDate: null,
    monitoringCycleDays: 90,
    regulatoryBasisSnapshot: {
      supportLevel: 6,
      behaviorScore: 18,
      serviceType: 'daily_life_care',
      eligibilityCheckedAt: '2026-01-01',
    },
    status: 'active',
    isCurrent: true,
    intake: {
      presentingProblem: '',
      targetBehaviorsDraft: [],
      behaviorItemsTotal: null,
      incidentSummaryLast30d: '',
      communicationModes: [],
      sensoryTriggers: [],
      medicalFlags: [],
      consentScope: [],
      consentDate: null,
    },
    assessment: {
      targetBehaviors: [],
      abcEvents: [],
      hypotheses: [],
      riskLevel: 'low',
      healthFactors: [],
      teamConsensusNote: '',
    },
    planning: {
      supportPriorities: [],
      antecedentStrategies: [],
      teachingStrategies: [],
      consequenceStrategies: [],
      procedureSteps: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'S001',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'S001',
    version: 1,
    ...overrides,
  };
}

// =========================================================================
// computeDaysOverdue
// =========================================================================

describe('computeDaysOverdue', () => {
  it('should return positive days when overdue', () => {
    const result = computeDaysOverdue('2026-03-01', '2026-03-11');
    expect(result).toBe(10);
  });

  it('should return negative days when not yet due', () => {
    const result = computeDaysOverdue('2026-03-20', '2026-03-10');
    expect(result).toBe(-10);
  });

  it('should return 0 on the due date', () => {
    const result = computeDaysOverdue('2026-03-10', '2026-03-10');
    expect(result).toBe(0);
  });

  it('should return null when nextReviewAt is null', () => {
    expect(computeDaysOverdue(null)).toBeNull();
  });

  it('should return null for invalid date', () => {
    expect(computeDaysOverdue('invalid-date')).toBeNull();
  });
});

// =========================================================================
// isReviewOverdue
// =========================================================================

describe('isReviewOverdue', () => {
  it('should return true when past due', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-01-01' });
    expect(isReviewOverdue(sheet, '2026-03-01')).toBe(true);
  });

  it('should return false when not yet due', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-12-31' });
    expect(isReviewOverdue(sheet, '2026-03-01')).toBe(false);
  });

  it('should return false on the exact due date', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-03-01' });
    expect(isReviewOverdue(sheet, '2026-03-01')).toBe(false);
  });

  it('should return false when nextReviewAt is null', () => {
    const sheet = makeSheet({ nextReviewAt: null });
    expect(isReviewOverdue(sheet)).toBe(false);
  });
});

// =========================================================================
// computeReviewAlertLevel
// =========================================================================

describe('computeReviewAlertLevel', () => {
  it('should return critical when overdue', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-01-01' });
    expect(computeReviewAlertLevel(sheet, '2026-03-01')).toBe('critical');
  });

  it('should return warning when within 30 days', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-03-20' });
    expect(computeReviewAlertLevel(sheet, '2026-03-01')).toBe('warning');
  });

  it('should return good when more than 30 days away', () => {
    const sheet = makeSheet({ nextReviewAt: '2026-12-31' });
    expect(computeReviewAlertLevel(sheet, '2026-03-01')).toBe('good');
  });

  it('should return none when nextReviewAt is null', () => {
    const sheet = makeSheet({ nextReviewAt: null });
    expect(computeReviewAlertLevel(sheet)).toBe('none');
  });
});

// =========================================================================
// createRevisionDraft
// =========================================================================

describe('createRevisionDraft', () => {
  it('should create a draft with version incremented', () => {
    const current = makeSheet({ version: 2 });
    const draft = createRevisionDraft(current, {
      changeReason: 'モニタリング結果による改訂',
      changedBy: 'S002',
    });

    expect(draft.version).toBe(3);
    expect(draft.status).toBe('draft');
    expect(draft.isCurrent).toBe(false);
    expect(draft.id).toBe('');
    expect(draft.createdBy).toBe('S002');
    expect(draft.updatedBy).toBe('S002');
    expect(draft.appliedFrom).toBeNull();
  });

  it('should copy content fields from current version', () => {
    const current = makeSheet({
      observationFacts: '行動特性A',
      interpretationHypothesis: '仮説X',
      supportPolicy: '方針Y',
    });
    const draft = createRevisionDraft(current, {
      changeReason: '改訂',
      changedBy: 'S002',
    });

    expect(draft.observationFacts).toBe('行動特性A');
    expect(draft.interpretationHypothesis).toBe('仮説X');
    expect(draft.supportPolicy).toBe('方針Y');
    expect(draft.userId).toBe('U001');
    expect(draft.ispId).toBe('ISP-001');
  });
});

// =========================================================================
// activatePlanningSheetVersion
// =========================================================================

describe('activatePlanningSheetVersion', () => {
  it('should promote target to active and archive old active', () => {
    const v1 = makeSheet({
      id: 'ps-v1',
      version: 1,
      status: 'active',
      isCurrent: true,
    });
    const v2 = makeSheet({
      id: 'ps-v2',
      version: 2,
      status: 'draft',
      isCurrent: false,
    });

    const result = activatePlanningSheetVersion(
      [v1, v2],
      'ps-v2',
      { activatedBy: 'S003', appliedFrom: '2026-04-01' },
    );

    const updated1 = result.find((s) => s.id === 'ps-v1')!;
    const updated2 = result.find((s) => s.id === 'ps-v2')!;

    // v2 promoted
    expect(updated2.status).toBe('active');
    expect(updated2.isCurrent).toBe(true);
    expect(updated2.appliedFrom).toBe('2026-04-01');
    expect(updated2.updatedBy).toBe('S003');

    // v1 archived
    expect(updated1.status).toBe('archived');
    expect(updated1.isCurrent).toBe(false);
  });

  it('should not modify unrelated versions', () => {
    const v1 = makeSheet({ id: 'v1', version: 1, status: 'archived', isCurrent: false });
    const v2 = makeSheet({ id: 'v2', version: 2, status: 'active', isCurrent: true });
    const v3 = makeSheet({ id: 'v3', version: 3, status: 'draft', isCurrent: false });

    const result = activatePlanningSheetVersion(
      [v1, v2, v3],
      'v3',
      { activatedBy: 'S001' },
    );

    // v1 stays archived
    expect(result.find((s) => s.id === 'v1')!.status).toBe('archived');
    // v2 archived (was active)
    expect(result.find((s) => s.id === 'v2')!.status).toBe('archived');
    // v3 promoted
    expect(result.find((s) => s.id === 'v3')!.status).toBe('active');
  });

  it('should throw when target not found', () => {
    const v1 = makeSheet({ id: 'v1' });
    expect(() =>
      activatePlanningSheetVersion([v1], 'nonexistent', { activatedBy: 'S001' }),
    ).toThrow('Version not found');
  });
});

// =========================================================================
// archivePlanningSheetVersion
// =========================================================================

describe('archivePlanningSheetVersion', () => {
  it('should set status to archived and isCurrent to false', () => {
    const sheet = makeSheet({ status: 'active', isCurrent: true });
    const archived = archivePlanningSheetVersion(sheet, {
      archivedBy: 'S001',
      reason: '新版へ移行',
    });

    expect(archived.status).toBe('archived');
    expect(archived.isCurrent).toBe(false);
    expect(archived.updatedBy).toBe('S001');
  });
});

// =========================================================================
// getPlanningSheetVersionHistory
// =========================================================================

describe('getPlanningSheetVersionHistory', () => {
  it('should return versions sorted by version number descending', () => {
    const v1 = makeSheet({ id: 'v1', version: 1, status: 'archived' });
    const v2 = makeSheet({ id: 'v2', version: 2, status: 'archived' });
    const v3 = makeSheet({ id: 'v3', version: 3, status: 'active' });

    const history = getPlanningSheetVersionHistory([v2, v1, v3]);

    expect(history).toHaveLength(3);
    expect(history[0].version).toBe(3);
    expect(history[1].version).toBe(2);
    expect(history[2].version).toBe(1);
    expect(history[0].isCurrent).toBe(true);
  });

  it('should return empty array for empty input', () => {
    expect(getPlanningSheetVersionHistory([])).toHaveLength(0);
  });
});

// =========================================================================
// toVersionHistoryEntries
// =========================================================================

describe('toVersionHistoryEntries', () => {
  it('should produce VersionHistoryEntry<SupportPlanningSheet> compatible objects', () => {
    const v1 = makeSheet({ id: 'v1', version: 1 });
    const v2 = makeSheet({ id: 'v2', version: 2 });

    const entries = toVersionHistoryEntries([v1, v2], {
      'v2': 'モニタリング結果による改訂',
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].version).toBe('v2');
    expect(entries[0].changeReason).toBe('モニタリング結果による改訂');
    expect(entries[1].version).toBe('v1');
    expect(entries[1].changeReason).toBe('');
    expect(entries[0].snapshot).toBeDefined();
    expect(entries[0].snapshot.id).toBe('v2');
  });
});

// =========================================================================
// computeVersionSummary
// =========================================================================

describe('computeVersionSummary', () => {
  it('should compute summary with active current version', () => {
    const v1 = makeSheet({
      id: 'v1',
      version: 1,
      status: 'archived',
      isCurrent: false,
    });
    const v2 = makeSheet({
      id: 'v2',
      version: 2,
      status: 'active',
      isCurrent: true,
      appliedFrom: '2026-04-01',
      nextReviewAt: '2026-09-30',
    });

    const summary = computeVersionSummary([v1, v2], '2026-06-01');

    expect(summary.totalVersions).toBe(2);
    expect(summary.currentVersion).toBe(2);
    expect(summary.currentAppliedFrom).toBe('2026-04-01');
    expect(summary.nextReviewAt).toBe('2026-09-30');
    expect(summary.isReviewOverdue).toBe(false);
    expect(summary.daysUntilReview).toBe(121); // June 1 → Sep 30
    expect(summary.hasDraft).toBe(false);
    expect(summary.hasReviewPending).toBe(false);
  });

  it('should detect overdue review', () => {
    const v1 = makeSheet({
      version: 1,
      status: 'active',
      isCurrent: true,
      nextReviewAt: '2026-01-01',
    });

    const summary = computeVersionSummary([v1], '2026-03-01');
    expect(summary.isReviewOverdue).toBe(true);
    expect(summary.daysUntilReview).toBe(-59); // negative = overdue
  });

  it('should detect draft and review pending', () => {
    const v1 = makeSheet({
      id: 'v1',
      version: 1,
      status: 'active',
      isCurrent: true,
    });
    const v2 = makeSheet({
      id: 'v2',
      version: 2,
      status: 'draft',
      isCurrent: false,
    });
    const v3 = makeSheet({
      id: 'v3',
      version: 3,
      status: 'review',
      isCurrent: false,
    });

    const summary = computeVersionSummary([v1, v2, v3]);
    expect(summary.hasDraft).toBe(true);
    expect(summary.hasReviewPending).toBe(true);
  });

  it('should handle empty input', () => {
    const summary = computeVersionSummary([]);

    expect(summary.totalVersions).toBe(0);
    expect(summary.currentVersion).toBeNull();
    expect(summary.isReviewOverdue).toBe(false);
  });
});

// =========================================================================
// getCurrentVersion / getLatestVersion
// =========================================================================

describe('getCurrentVersion', () => {
  it('should return the active + isCurrent sheet', () => {
    const v1 = makeSheet({ id: 'v1', status: 'archived', isCurrent: false });
    const v2 = makeSheet({ id: 'v2', status: 'active', isCurrent: true });

    expect(getCurrentVersion([v1, v2])?.id).toBe('v2');
  });

  it('should return null when no active version', () => {
    const v1 = makeSheet({ status: 'draft', isCurrent: false });
    expect(getCurrentVersion([v1])).toBeNull();
  });
});

describe('getLatestVersion', () => {
  it('should return the highest version number', () => {
    const v1 = makeSheet({ id: 'v1', version: 1 });
    const v3 = makeSheet({ id: 'v3', version: 3 });
    const v2 = makeSheet({ id: 'v2', version: 2 });

    expect(getLatestVersion([v1, v3, v2])?.id).toBe('v3');
  });

  it('should return null for empty input', () => {
    expect(getLatestVersion([])).toBeNull();
  });
});

// =========================================================================
// sortByVersionDescFull
// =========================================================================

describe('sortByVersionDescFull', () => {
  it('should sort sheets by version descending', () => {
    const sheets = [
      makeSheet({ version: 1 }),
      makeSheet({ version: 3 }),
      makeSheet({ version: 2 }),
    ];

    const sorted = sortByVersionDescFull(sheets);
    expect(sorted[0].version).toBe(3);
    expect(sorted[1].version).toBe(2);
    expect(sorted[2].version).toBe(1);
  });

  it('should not mutate original array', () => {
    const sheets = [makeSheet({ version: 2 }), makeSheet({ version: 1 })];
    sortByVersionDescFull(sheets);
    expect(sheets[0].version).toBe(2);
  });
});
