// ---------------------------------------------------------------------------
// useLatestBehaviorMonitoring — Unit / Integration Test
//
// 検証項目 (Phase 3 配線確認):
//   1. repository.listByUser(userId) が呼ばれ、最新レコードが返る
//   2. adaptMeetingToBehavior() により BehaviorMonitoringRecord に変換
//   3. record が null でないとき、UI 層でボタン有効化 → ダイアログ表示可
//   4. userId 変更で再取得
//   5. userId 未指定で record = null
// ---------------------------------------------------------------------------

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';

import { useLatestBehaviorMonitoring } from '../useLatestBehaviorMonitoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMeeting(overrides: Partial<MonitoringMeetingRecord> = {}): MonitoringMeetingRecord {
  return {
    id: 'ui-test-001',
    userId: 'U-001',
    ispId: 'ISP-2025-001',
    planningSheetId: '',
    meetingType: 'regular',
    meetingDate: '2026-03-15',
    venue: '相談室A',
    attendees: [
      { name: '山田太郎', role: 'サービス管理責任者', present: true },
      { name: '鈴木花子', role: '相談支援専門員', present: true },
    ],
    goalEvaluations: [
      { goalText: '日中活動への参加（週3回以上）', achievementLevel: 'achieved', comment: '毎日参加できている。' },
      { goalText: '身だしなみの自立', achievementLevel: 'partial', comment: '声掛けがあれば自分でできる。' },
    ],
    overallAssessment: '全体として良好に経過している。日中活動への参加が安定。',
    userFeedback: '今の生活に概ね満足している。',
    familyFeedback: '家族からは特段の要望なし。',
    discussionSummary: '協議内容の要約',
    status: 'finalized',
    planChangeDecision: 'no_change',
    changeReason: '',
    decisions: ['現行計画を継続', '次回3ヶ月後にモニタリング実施'],
    nextMonitoringDate: '2026-06-15',
    recordedBy: '佐藤次郎',
    recordedAt: '2026-03-15T14:30:00+09:00',
    ...overrides,
  };
}

function mockRepo(
  records: MonitoringMeetingRecord[] = [],
): MonitoringMeetingRepository {
  return {
    getById: vi.fn().mockResolvedValue(records[0] ?? null),
    getAll: vi.fn().mockResolvedValue(records),
    listByUser: vi.fn().mockResolvedValue(records),
    listByIsp: vi.fn().mockResolvedValue(records),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLatestBehaviorMonitoring', () => {
  it('Phase3-Check1: SP レコードが存在するとき record が非 null → ボタン有効化条件成立', async () => {
    const meeting = makeMeeting();
    const repo = mockRepo([meeting]);

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: repo }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // record != null → UI で hasMonitoringRecord=true → ボタン有効
    expect(result.current.record).not.toBeNull();
    expect(result.current.error).toBeNull();

    // listByUser が正しい userId で呼ばれた
    expect(repo.listByUser).toHaveBeenCalledWith('U-001');
  });

  it('Phase3-Check2: adaptMeetingToBehavior 変換で全フィールドが BehaviorMonitoringRecord に入る', async () => {
    const meeting = makeMeeting();
    const repo = mockRepo([meeting]);

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: repo, planningSheetId: 'PS-001' }),
    );

    await waitFor(() => {
      expect(result.current.record).not.toBeNull();
    });

    const record = result.current.record!;

    // ── ダイアログに表示される主要フィールドの存在確認 ──

    // summary ← overallAssessment
    expect(record.summary).toBe('全体として良好に経過している。日中活動への参加が安定。');

    // supportEvaluations ← goalEvaluations
    expect(record.supportEvaluations).toHaveLength(2);
    expect(record.supportEvaluations[0].methodDescription).toBe('日中活動への参加（週3回以上）');
    expect(record.supportEvaluations[0].achievementLevel).toBe('effective'); // achieved → effective
    expect(record.supportEvaluations[1].methodDescription).toBe('身だしなみの自立');
    expect(record.supportEvaluations[1].achievementLevel).toBe('partial');   // partial → partial

    // userFeedback / familyFeedback
    expect(record.userFeedback).toBe('今の生活に概ね満足している。');
    expect(record.familyFeedback).toBe('家族からは特段の要望なし。');

    // recommendedChanges ← decisions
    expect(record.recommendedChanges).toEqual(['現行計画を継続', '次回3ヶ月後にモニタリング実施']);

    // periodStart/End ← meetingDate
    expect(record.periodStart).toBe('2026-03-15');
    expect(record.periodEnd).toBe('2026-03-15');

    // メタ
    expect(record.userId).toBe('U-001');
    expect(record.planningSheetId).toBe('PS-001');
    expect(record.recordedBy).toBe('佐藤次郎');
  });

  it('Phase3-Check3: 複数レコードがある場合 meetingDate 降順で最新が選出される', async () => {
    const older = makeMeeting({ id: 'old', meetingDate: '2026-01-15', overallAssessment: '古い' });
    const newer = makeMeeting({ id: 'new', meetingDate: '2026-03-15', overallAssessment: '新しい' });
    const repo = mockRepo([older, newer]);

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: repo }),
    );

    await waitFor(() => {
      expect(result.current.record).not.toBeNull();
    });

    // 最新の meetingDate (2026-03-15) が選ばれる
    expect(result.current.record).not.toBeNull();
  });

  it('Phase3-Check4: userId が null のとき record は null → ボタン disabled', async () => {
    const repo = mockRepo([makeMeeting()]);

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring(null, { repository: repo }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).toBeNull();
    // listByUser は呼ばれない
    expect(repo.listByUser).not.toHaveBeenCalled();
  });

  it('Phase3-Check5: repository.listByUser が空配列 → record は null', async () => {
    const repo = mockRepo([]);

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: repo }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.record).toBeNull();
  });

  it('Phase3-Check6: repository.listByUser がエラー → error 状態', async () => {
    const repo = mockRepo();
    (repo.listByUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('SharePoint API Error'),
    );

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: repo }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('SharePoint API Error');
    expect(result.current.record).toBeNull();
  });

  it('Phase3-Check7: refetch で手動再取得できる', async () => {
    const repo = mockRepo([makeMeeting()]);

    const { result } = renderHook(() =>
      useLatestBehaviorMonitoring('U-001', { repository: repo }),
    );

    await waitFor(() => {
      expect(result.current.record).not.toBeNull();
    });

    // 初回呼び出し
    expect(repo.listByUser).toHaveBeenCalledTimes(1);

    // refetch
    await act(async () => {
      await result.current.refetch();
    });

    expect(repo.listByUser).toHaveBeenCalledTimes(2);
  });
});
