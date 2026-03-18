// ---------------------------------------------------------------------------
// useLatestBehaviorMonitoring.spec.ts
//
// テスト観点:
//   1. userId なしなら record: null
//   2. 記録なしなら record: null
//   3. 複数記録があるとき meetingDate が最新の1件を返す
//   4. adaptMeetingToBehavior() の結果が返る
//   5. repository 失敗時に error が返る
//   6. userId が変わったら再取得
//   7. refetch で手動再取得
// ---------------------------------------------------------------------------

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';

import {
  useLatestBehaviorMonitoring,
  type UseLatestBehaviorMonitoringOptions,
} from '../useLatestBehaviorMonitoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMeeting(
  overrides: Partial<MonitoringMeetingRecord> = {},
): MonitoringMeetingRecord {
  return {
    id: 'mtg-1',
    userId: 'U-001',
    ispId: 'isp-1',
    meetingType: 'regular',
    meetingDate: '2026-01-15',
    venue: '会議室A',
    attendees: [],
    goalEvaluations: [
      { goalText: '自立歩行の練習', achievementLevel: 'partial', comment: '改善傾向' },
    ],
    overallAssessment: '全体的に安定',
    userFeedback: '本人は前向き',
    familyFeedback: '家族も同意',
    planChangeDecision: 'no_change',
    changeReason: '',
    decisions: ['現行計画を継続'],
    nextMonitoringDate: '2026-07-15',
    recordedBy: '佐藤',
    recordedAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function createMockRepository(
  overrides: Partial<MonitoringMeetingRepository> = {},
): MonitoringMeetingRepository {
  return {
    save: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    listByUser: vi.fn().mockResolvedValue([]),
    listByIsp: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    ...overrides,
  };
}

function defaultOptions(repo: MonitoringMeetingRepository): UseLatestBehaviorMonitoringOptions {
  return { repository: repo, planningSheetId: 'ps-1' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLatestBehaviorMonitoring', () => {
  let mockRepo: MonitoringMeetingRepository;

  beforeEach(() => {
    mockRepo = createMockRepository();
  });

  // ── 1. userId なし → record: null ──
  it('returns null record when userId is null', async () => {
    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring(null, defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockRepo.listByUser).not.toHaveBeenCalled();
  });

  it('returns null record when userId is undefined', async () => {
    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring(undefined, defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).toBeNull();
  });

  it('returns null record when userId is empty string', async () => {
    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('', defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // 空文字は falsy なので null
    expect(result.current.record).toBeNull();
    expect(mockRepo.listByUser).not.toHaveBeenCalled();
  });

  // ── 2. 記録なし → record: null ──
  it('returns null record when repository returns empty list', async () => {
    mockRepo = createMockRepository({
      listByUser: vi.fn().mockResolvedValue([]),
    });

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockRepo.listByUser).toHaveBeenCalledWith('U-001');
  });

  // ── 3. 複数記録 → meetingDate 最新1件 ──
  it('picks the latest record by meetingDate (descending)', async () => {
    const older = createMeeting({ id: 'mtg-old', meetingDate: '2025-06-01' });
    const newer = createMeeting({ id: 'mtg-new', meetingDate: '2026-03-01' });
    const middle = createMeeting({ id: 'mtg-mid', meetingDate: '2025-12-01' });

    mockRepo = createMockRepository({
      listByUser: vi.fn().mockResolvedValue([older, newer, middle]),
    });

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).not.toBeNull();
    // adaptMeetingToBehavior は id を `bm-from-${meeting.id}` にする
    expect(result.current.record!.id).toBe('bm-from-mtg-new');
  });

  // ── 4. adaptMeetingToBehavior の結果が返る ──
  it('returns a properly adapted BehaviorMonitoringRecord', async () => {
    const meeting = createMeeting({
      id: 'mtg-adapted',
      userId: 'U-001',
      meetingDate: '2026-02-15',
      overallAssessment: '安定傾向',
      userFeedback: '本人の希望あり',
      familyFeedback: '家族は了承',
      decisions: ['環境調整を実施'],
    });

    mockRepo = createMockRepository({
      listByUser: vi.fn().mockResolvedValue([meeting]),
    });

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: mockRepo, planningSheetId: 'ps-test' }),
    );

    await waitFor(() => {
      expect(result.current.record).not.toBeNull();
    });

    const rec = result.current.record!;
    expect(rec.id).toBe('bm-from-mtg-adapted');
    expect(rec.userId).toBe('U-001');
    expect(rec.planningSheetId).toBe('ps-test');
    expect(rec.summary).toBe('安定傾向');
    expect(rec.userFeedback).toBe('本人の希望あり');
    expect(rec.familyFeedback).toBe('家族は了承');
    expect(rec.recommendedChanges).toEqual(['環境調整を実施']);
    // goalEvaluations → supportEvaluations
    expect(rec.supportEvaluations).toHaveLength(1);
    expect(rec.supportEvaluations[0].methodDescription).toBe('自立歩行の練習');
    expect(rec.supportEvaluations[0].achievementLevel).toBe('partial');
  });

  // ── 5. repository 失敗 → error ──
  it('sets error when repository throws', async () => {
    mockRepo = createMockRepository({
      listByUser: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Network failure');
  });

  // ── 6. userId が変わったら再取得 ──
  it('refetches when userId changes', async () => {
    const meetingA = createMeeting({ id: 'mtg-a', userId: 'U-001' });
    const meetingB = createMeeting({ id: 'mtg-b', userId: 'U-002' });

    const listByUser = vi.fn().mockImplementation(async (uid: string) => {
      if (uid === 'U-001') return [meetingA];
      if (uid === 'U-002') return [meetingB];
      return [];
    });

    mockRepo = createMockRepository({ listByUser });

    const { result, rerender } = renderHook(
      ({ uid }) => useLatestBehaviorMonitoring(uid, defaultOptions(mockRepo)),
      { initialProps: { uid: 'U-001' as string | null } },
    );

    await waitFor(() => {
      expect(result.current.record?.id).toBe('bm-from-mtg-a');
    });

    rerender({ uid: 'U-002' });

    await waitFor(() => {
      expect(result.current.record?.id).toBe('bm-from-mtg-b');
    });

    expect(listByUser).toHaveBeenCalledTimes(2);
  });

  // ── 7. refetch で手動再取得 ──
  it('supports manual refetch', async () => {
    const listByUser = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createMeeting({ id: 'mtg-after-refetch' })]);

    mockRepo = createMockRepository({ listByUser });

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', defaultOptions(mockRepo)),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.record).toBeNull();

    // データが追加された想定で refetch
    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.record).not.toBeNull();
    });

    expect(result.current.record!.id).toBe('bm-from-mtg-after-refetch');
    expect(listByUser).toHaveBeenCalledTimes(2);
  });

  // ── 8. planningSheetId が未指定のとき 'new' をデフォルト適用 ──
  it('uses "new" as default planningSheetId', async () => {
    const meeting = createMeeting({ id: 'mtg-default-ps' });

    mockRepo = createMockRepository({
      listByUser: vi.fn().mockResolvedValue([meeting]),
    });

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: mockRepo }),
    );

    await waitFor(() => {
      expect(result.current.record).not.toBeNull();
    });

    expect(result.current.record!.planningSheetId).toBe('new');
  });
});
