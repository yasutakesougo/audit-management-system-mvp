// ---------------------------------------------------------------------------
// spMonitoringMeetingRepository.spec.ts
//
// テスト観点:
//   1. mapSpRowToMonitoringMeeting — SP 行 → Domain 変換
//   2. buildMonitoringMeetingBody — Domain → SP body 変換
//   3. getById — recordId でフィルタ
//   4. listByUser — userId でフィルタ
//   5. listByIsp — ispId でフィルタ
//   6. save (create) — 新規レコード
//   7. save (update) — 既存レコード
//   8. delete — recordId → SP Id 逆引き → 削除
//   9. delete — 存在しないレコードは冪等
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  mapSpRowToMonitoringMeeting,
  buildMonitoringMeetingBody,
  createSpMonitoringMeetingRepository,
} from '../spMonitoringMeetingRepository';
import type { SpMonitoringMeetingRow } from '@/sharepoint/fields/monitoringMeetingFields';
import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { UseSP } from '@/lib/spClient';

// ────────────────────────────────────────────────────────────────
// Test Data
// ────────────────────────────────────────────────────────────────

const SAMPLE_ROW: SpMonitoringMeetingRow = {
  Id: 42,
  cr014_recordId: 'rec-001',
  cr014_userId: 'user-A',
  cr014_ispId: 'isp-001',
  cr014_planningSheetId: 'ps-001',
  cr014_meetingType: 'regular',
  cr014_meetingDate: '2026-03-15',
  cr014_venue: '会議室A',
  cr014_attendeesJson: JSON.stringify([{ name: '田中', role: '相談支援専門員', present: true }]),
  cr014_goalEvaluationsJson: JSON.stringify([
    {
      goalText: '外出支援',
      achievementLevel: 'achieved',
      comment: '良好',
    },
  ]),
  cr014_overallAssessment: '概ね良好',
  cr014_userFeedback: '利用者の声',
  cr014_familyFeedback: '家族の声',
  cr014_planChangeDecision: 'no_change',
  cr014_changeReason: '',
  cr014_decisionsJson: JSON.stringify(['決定事項1']),
  cr014_nextMonitoringDate: '2026-06-15',
  cr014_recordedBy: 'recorder-1',
  cr014_recordedAt: '2026-03-15T10:00:00+09:00',
};

const SAMPLE_DOMAIN: MonitoringMeetingRecord = {
  id: 'rec-001',
  userId: 'user-A',
  ispId: 'isp-001',
  planningSheetId: 'ps-001',
  meetingType: 'regular',
  meetingDate: '2026-03-15',
  venue: '会議室A',
  attendees: [{ name: '田中', role: '相談支援専門員', present: true }],
  goalEvaluations: [
    {
      goalText: '外出支援',
      achievementLevel: 'achieved',
      comment: '良好',
    },
  ],
  overallAssessment: '概ね良好',
  userFeedback: '利用者の声',
  familyFeedback: '家族の声',
  planChangeDecision: 'no_change',
  changeReason: '',
  decisions: ['決定事項1'],
  nextMonitoringDate: '2026-06-15',
  recordedBy: 'recorder-1',
  recordedAt: '2026-03-15T10:00:00+09:00',
};

// ────────────────────────────────────────────────────────────────
// Mock UseSP
// ────────────────────────────────────────────────────────────────

function createMockClient() {
  return {
    listItems: vi.fn(),
    addListItemByTitle: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    // unused but required by type
    spFetch: vi.fn(),
    getListItemsByTitle: vi.fn(),
    addItemByTitle: vi.fn(),
    updateItemByTitle: vi.fn(),
    deleteItemByTitle: vi.fn(),
    getItemById: vi.fn(),
    getItemByIdWithEtag: vi.fn(),
    createItem: vi.fn(),
    batch: vi.fn(),
    postBatch: vi.fn(),
    ensureListExists: vi.fn(),
    tryGetListMetadata: vi.fn(),
    getListFieldInternalNames: vi.fn(),
  } as unknown as UseSP & {
    listItems: ReturnType<typeof vi.fn>;
    addListItemByTitle: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
  };
}

// ────────────────────────────────────────────────────────────────
// 1. mapSpRowToMonitoringMeeting
// ────────────────────────────────────────────────────────────────

describe('mapSpRowToMonitoringMeeting', () => {
  it('converts a full SP row to domain record', () => {
    const result = mapSpRowToMonitoringMeeting(SAMPLE_ROW);

    expect(result.id).toBe('rec-001');
    expect(result.userId).toBe('user-A');
    expect(result.ispId).toBe('isp-001');
    expect(result.planningSheetId).toBe('ps-001');
    expect(result.meetingType).toBe('regular');
    expect(result.meetingDate).toBe('2026-03-15');
    expect(result.attendees).toHaveLength(1);
    expect(result.attendees[0].name).toBe('田中');
    expect(result.goalEvaluations).toHaveLength(1);
    expect(result.goalEvaluations[0].achievementLevel).toBe('achieved');
    expect(result.planChangeDecision).toBe('no_change');
    expect(result.decisions).toEqual(['決定事項1']);
  });

  it('normalizes null optional fields', () => {
    const minimalRow: SpMonitoringMeetingRow = {
      Id: 1,
      cr014_recordId: 'rec-min',
      cr014_userId: 'user-B',
      cr014_ispId: 'isp-002',
      cr014_planningSheetId: undefined,
      cr014_meetingType: 'regular',
      cr014_meetingDate: '2026-01-01',
      cr014_venue: '',
      cr014_attendeesJson: undefined,
      cr014_goalEvaluationsJson: undefined,
      cr014_overallAssessment: undefined,
      cr014_userFeedback: undefined,
      cr014_familyFeedback: undefined,
      cr014_planChangeDecision: undefined,
      cr014_changeReason: undefined,
      cr014_decisionsJson: undefined,
      cr014_nextMonitoringDate: undefined,
      cr014_recordedBy: undefined,
      cr014_recordedAt: undefined,
    };

    const result = mapSpRowToMonitoringMeeting(minimalRow);

    expect(result.planningSheetId).toBeUndefined();
    expect(result.familyFeedback).toBe('');
    expect(result.changeReason).toBe('');
    expect(result.decisions).toEqual([]);
    expect(result.attendees).toEqual([]);
    expect(result.goalEvaluations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────
// 2. buildMonitoringMeetingBody
// ────────────────────────────────────────────────────────────────

describe('buildMonitoringMeetingBody', () => {
  it('builds a valid SP body from domain record', () => {
    const body = buildMonitoringMeetingBody(SAMPLE_DOMAIN);

    expect(body.Title).toBe('user-A_2026-03-15');
    expect(body.cr014_recordId).toBe('rec-001');
    expect(body.cr014_userId).toBe('user-A');
    expect(body.cr014_meetingDate).toBe('2026-03-15');
    expect(body.cr014_attendeesJson).toContain('田中');
    expect(body.cr014_goalEvaluationsJson).toContain('外出支援');
    expect(body.cr014_decisionsJson).toContain('決定事項1');
  });

  it('zero-pads single-digit date components', () => {
    const record: MonitoringMeetingRecord = {
      ...SAMPLE_DOMAIN,
      meetingDate: '2026-3-5',
      nextMonitoringDate: '2026-6-8',
    };
    const body = buildMonitoringMeetingBody(record);

    expect(body.cr014_meetingDate).toBe('2026-03-05');
    expect(body.cr014_nextMonitoringDate).toBe('2026-06-08');
    expect(body.Title).toBe('user-A_2026-03-05');
  });
});

// ────────────────────────────────────────────────────────────────
// 3-9. Repository CRUD
// ────────────────────────────────────────────────────────────────

describe('createSpMonitoringMeetingRepository', () => {
  let client: ReturnType<typeof createMockClient>;
  let repo: ReturnType<typeof createSpMonitoringMeetingRepository>;

  beforeEach(() => {
    client = createMockClient();
    repo = createSpMonitoringMeetingRepository(client);
  });

  // ── 3. getById ──
  describe('getById', () => {
    it('returns domain record when found', async () => {
      client.listItems.mockResolvedValueOnce([SAMPLE_ROW]);

      const result = await repo.getById('rec-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('rec-001');
      expect(client.listItems).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          filter: expect.stringContaining('rec-001'),
          top: 1,
        }),
      );
    });

    it('returns null when not found', async () => {
      client.listItems.mockResolvedValueOnce([]);

      const result = await repo.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── 4. listByUser ──
  describe('listByUser', () => {
    it('filters by userId and returns domain records', async () => {
      client.listItems.mockResolvedValueOnce([SAMPLE_ROW]);

      const results = await repo.listByUser('user-A');

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('user-A');
      expect(client.listItems).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          filter: expect.stringContaining('user-A'),
          orderby: expect.stringContaining('desc'),
        }),
      );
    });
  });

  // ── 5. listByIsp ──
  describe('listByIsp', () => {
    it('filters by ispId and returns domain records', async () => {
      client.listItems.mockResolvedValueOnce([SAMPLE_ROW]);

      const results = await repo.listByIsp('isp-001');

      expect(results).toHaveLength(1);
      expect(results[0].ispId).toBe('isp-001');
    });
  });

  // ── 6. save (create) ──
  describe('save — create', () => {
    it('creates a new record when recordId not found', async () => {
      // findSpItemIdByRecordId → not found
      client.listItems.mockResolvedValueOnce([]);
      // addListItemByTitle
      client.addListItemByTitle.mockResolvedValueOnce({});
      // re-fetch
      client.listItems.mockResolvedValueOnce([SAMPLE_ROW]);

      const result = await repo.save(SAMPLE_DOMAIN);

      expect(result.id).toBe('rec-001');
      expect(client.addListItemByTitle).toHaveBeenCalledTimes(1);
      expect(client.updateItem).not.toHaveBeenCalled();
    });
  });

  // ── 7. save (update) ──
  describe('save — update', () => {
    it('updates an existing record when recordId found', async () => {
      // findSpItemIdByRecordId → found with SP Id 42
      client.listItems.mockResolvedValueOnce([{ Id: 42 }]);
      // updateItem
      client.updateItem.mockResolvedValueOnce(undefined);
      // re-fetch
      client.listItems.mockResolvedValueOnce([SAMPLE_ROW]);

      const result = await repo.save(SAMPLE_DOMAIN);

      expect(result.id).toBe('rec-001');
      expect(client.updateItem).toHaveBeenCalledWith(
        expect.any(String),
        42,
        expect.objectContaining({ cr014_recordId: 'rec-001' }),
      );
      expect(client.addListItemByTitle).not.toHaveBeenCalled();
    });
  });

  // ── 8. delete ──
  describe('delete', () => {
    it('deletes a record by resolving SP Id from recordId', async () => {
      // findSpItemIdByRecordId → found with SP Id 42
      client.listItems.mockResolvedValueOnce([{ Id: 42 }]);
      client.deleteItem.mockResolvedValueOnce(undefined);

      await repo.delete('rec-001');

      expect(client.deleteItem).toHaveBeenCalledWith(expect.any(String), 42);
    });

    // ── 9. delete — 冪等性 ──
    it('does nothing when recordId not found (idempotent)', async () => {
      client.listItems.mockResolvedValueOnce([]);

      await repo.delete('nonexistent');

      expect(client.deleteItem).not.toHaveBeenCalled();
    });
  });
});
