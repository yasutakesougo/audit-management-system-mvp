// ---------------------------------------------------------------------------
// localComplianceRepository.spec.ts — 適正化運用リポジトリのユニットテスト
//
// 委員会記録・指針版管理・研修記録の3つの LocalStorage リポジトリの
// CRUD 操作・ステータス更新・FIFO 制限をテストする。
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import {
  localCommitteeRepository,
  localGuidelineRepository,
  localTrainingRepository,
} from '@/infra/localStorage/localComplianceRepository';
import type { CommitteeMeetingRecord } from '@/domain/safety/complianceCommittee';
import type { GuidelineVersion } from '@/domain/safety/guidelineVersion';
import type { TrainingRecord } from '@/domain/safety/trainingRecord';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeCommitteeRecord(
  overrides: Partial<CommitteeMeetingRecord> = {},
): CommitteeMeetingRecord {
  return {
    id: `cmte_${Date.now()}`,
    meetingDate: '2026-01-15',
    committeeType: '定期開催',
    agenda: 'テスト議題',
    attendees: [],
    summary: 'テスト概要',
    decisions: 'テスト決定',
    issues: '',
    restraintDiscussed: false,
    restraintDiscussionDetail: '',
    recordedBy: 'staff_1',
    recordedAt: '2026-01-15T10:00:00Z',
    status: 'finalized',
    ...overrides,
  };
}

function makeGuidelineVersion(
  overrides: Partial<GuidelineVersion> = {},
): GuidelineVersion {
  return {
    id: `gl_${Date.now()}`,
    version: '1.0',
    title: 'テスト指針',
    content: 'テスト内容',
    changeType: '新規策定',
    changeReason: '',
    requiredItems: {
      procedureForRestraint: false,
      organizationalStructure: false,
      staffTrainingPolicy: false,
      reportingProcedure: false,
      threeRequirementsVerification: false,
      userExplanationMethod: false,
      reviewReleaseProcess: false,
    },
    effectiveDate: '2026-04-01',
    status: 'draft',
    createdBy: 'staff_1',
    createdAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

function makeTrainingRecord(
  overrides: Partial<TrainingRecord> = {},
): TrainingRecord {
  return {
    id: `trn_${Date.now()}`,
    title: 'テスト研修',
    trainingType: '身体拘束等適正化研修',
    format: '集合研修',
    trainingDate: '2026-01-20',
    durationMinutes: 120,
    description: 'テスト研修内容',
    materials: '',
    instructor: '山田太郎',
    participants: [],
    achievementNotes: '',
    improvementNotes: '',
    recordedBy: 'staff_1',
    recordedAt: '2026-01-20T10:00:00Z',
    status: 'completed',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// =========================================================================
// Committee Repository
// =========================================================================

describe('localCommitteeRepository', () => {
  it('saves and retrieves a record', async () => {
    const record = makeCommitteeRecord({ id: 'cmte_1' });
    await localCommitteeRepository.save(record);

    const result = await localCommitteeRepository.getById('cmte_1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('cmte_1');
    expect(result!.agenda).toBe('テスト議題');
  });

  it('generates id when empty', async () => {
    const record = makeCommitteeRecord({ id: '' });
    const saved = await localCommitteeRepository.save(record);
    expect(saved.id).toMatch(/^cmte_/);
  });

  it('updates existing record', async () => {
    const record = makeCommitteeRecord({ id: 'cmte_2', agenda: '初回' });
    await localCommitteeRepository.save(record);

    const updated = makeCommitteeRecord({ id: 'cmte_2', agenda: '更新後' });
    await localCommitteeRepository.save(updated);

    const all = await localCommitteeRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].agenda).toBe('更新後');
  });

  it('getAll returns all records', async () => {
    await localCommitteeRepository.save(makeCommitteeRecord({ id: 'c1' }));
    await localCommitteeRepository.save(makeCommitteeRecord({ id: 'c2' }));

    const all = await localCommitteeRepository.getAll();
    expect(all).toHaveLength(2);
  });

  it('delete removes a record', async () => {
    await localCommitteeRepository.save(makeCommitteeRecord({ id: 'c1' }));
    await localCommitteeRepository.delete('c1');

    const result = await localCommitteeRepository.getById('c1');
    expect(result).toBeNull();
  });

  it('getById returns null for non-existent', async () => {
    const result = await localCommitteeRepository.getById('nonexistent');
    expect(result).toBeNull();
  });
});

// =========================================================================
// Guideline Repository
// =========================================================================

describe('localGuidelineRepository', () => {
  it('saves and retrieves a version', async () => {
    const version = makeGuidelineVersion({ id: 'gl_1' });
    await localGuidelineRepository.save(version);

    const result = await localGuidelineRepository.getById('gl_1');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('テスト指針');
  });

  it('getCurrent returns the active version', async () => {
    await localGuidelineRepository.save(
      makeGuidelineVersion({ id: 'gl_old', status: 'archived', effectiveDate: '2025-04-01' }),
    );
    await localGuidelineRepository.save(
      makeGuidelineVersion({ id: 'gl_new', status: 'active', effectiveDate: '2026-04-01' }),
    );

    const current = await localGuidelineRepository.getCurrent();
    expect(current).not.toBeNull();
    expect(current!.id).toBe('gl_new');
  });

  it('getCurrent returns null when no active version', async () => {
    await localGuidelineRepository.save(
      makeGuidelineVersion({ id: 'gl_draft', status: 'draft' }),
    );

    const current = await localGuidelineRepository.getCurrent();
    expect(current).toBeNull();
  });

  it('updateStatus changes the status', async () => {
    await localGuidelineRepository.save(
      makeGuidelineVersion({ id: 'gl_1', status: 'draft' }),
    );

    const updated = await localGuidelineRepository.updateStatus('gl_1', 'active');
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('active');

    // Verify persistence
    const fetched = await localGuidelineRepository.getById('gl_1');
    expect(fetched!.status).toBe('active');
  });

  it('updateStatus returns null for non-existent', async () => {
    const result = await localGuidelineRepository.updateStatus('nonexistent', 'active');
    expect(result).toBeNull();
  });

  it('delete removes a version', async () => {
    await localGuidelineRepository.save(makeGuidelineVersion({ id: 'gl_1' }));
    await localGuidelineRepository.delete('gl_1');

    expect(await localGuidelineRepository.getById('gl_1')).toBeNull();
  });
});

// =========================================================================
// Training Repository
// =========================================================================

describe('localTrainingRepository', () => {
  it('saves and retrieves a record', async () => {
    const record = makeTrainingRecord({ id: 'trn_1' });
    await localTrainingRepository.save(record);

    const result = await localTrainingRepository.getById('trn_1');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('テスト研修');
  });

  it('generates id when empty', async () => {
    const saved = await localTrainingRepository.save(
      makeTrainingRecord({ id: '' }),
    );
    expect(saved.id).toMatch(/^trn_/);
  });

  it('updateStatus changes the status', async () => {
    await localTrainingRepository.save(
      makeTrainingRecord({ id: 'trn_1', status: 'completed' }),
    );

    const updated = await localTrainingRepository.updateStatus('trn_1', 'cancelled');
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('cancelled');
  });

  it('updateStatus returns null for non-existent', async () => {
    const result = await localTrainingRepository.updateStatus('nonexistent', 'cancelled');
    expect(result).toBeNull();
  });

  it('delete removes a record', async () => {
    await localTrainingRepository.save(makeTrainingRecord({ id: 'trn_1' }));
    await localTrainingRepository.delete('trn_1');

    expect(await localTrainingRepository.getById('trn_1')).toBeNull();
    expect(await localTrainingRepository.getAll()).toHaveLength(0);
  });

  it('getAll returns all records', async () => {
    await localTrainingRepository.save(makeTrainingRecord({ id: 't1' }));
    await localTrainingRepository.save(makeTrainingRecord({ id: 't2' }));
    await localTrainingRepository.save(makeTrainingRecord({ id: 't3' }));

    expect(await localTrainingRepository.getAll()).toHaveLength(3);
  });
});
