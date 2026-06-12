import { act, renderHook } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { suppressConsoleDuring } from '../../../../tests/unit/_helpers/consoleSpyHelper';

import { useTableDailyRecordViewModel } from '../table/useTableDailyRecordViewModel';

const navigateMock = vi.fn();
const mocks = vi.hoisted(() => {
  const dailySave = vi.fn().mockResolvedValue(undefined);
  return {
    dailyRepository: {
      save: dailySave,
    },
    provider: {
      listItems: vi.fn(),
      getItemById: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      getMetadata: vi.fn(),
      getResourceNames: vi.fn(),
      getFieldInternalNames: vi.fn(),
      ensureListExists: vi.fn(),
      seed: vi.fn(),
    },
    saveDailyRecordWithQualityReview: vi.fn().mockResolvedValue({
      savedDailyRecord: true,
      createdReviewCount: 1,
      skippedReviewCount: 0,
      emptyTextSkippedReviewCount: 0,
      existingReviewSkippedReviewCount: 0,
    }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ search: '', pathname: '/today' }),
  };
});

vi.mock('@/lib/nav/useCancelToDashboard', () => ({
  useCancelToToday: () => () => navigateMock('/today', { replace: true }),
}));

vi.mock('../repositoryFactory', () => ({
  useDailyRecordRepository: () => mocks.dailyRepository,
}));

vi.mock('@/lib/data/useDataProvider', () => ({
  useDataProvider: () => ({
    provider: mocks.provider,
    type: 'sharepoint',
  }),
}));

vi.mock('@/features/record-quality/application/saveDailyRecordWithQualityReview', () => ({
  saveDailyRecordWithQualityReview: mocks.saveDailyRecordWithQualityReview,
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('useTableDailyRecordViewModel', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    mocks.dailyRepository.save.mockClear();
    mocks.saveDailyRecordWithQualityReview.mockClear();
    mocks.saveDailyRecordWithQualityReview.mockResolvedValue({
      savedDailyRecord: true,
      createdReviewCount: 1,
      skippedReviewCount: 0,
      emptyTextSkippedReviewCount: 0,
      existingReviewSkippedReviewCount: 0,
    });
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns expected shape and closes after save', async () => {
    const { result } = renderHook(() => useTableDailyRecordViewModel());

    expect(result.current.open).toBe(true);
    expect(result.current.title).toBe('一覧形式の日々の記録');
    expect(result.current.backTo).toBe('/today');
    expect(result.current.testId).toBe('daily-table-record-page');

    const payload = {
      date: '2026-02-07',
      reporter: { name: 'テスト担当者', role: '生活支援員' },
      userRows: [
        {
          userId: 'U001',
          userName: '山田太郎',
          amActivity: '朝の活動',
          pmActivity: '午後の活動',
          lunchAmount: 'full',
          problemBehavior: {
            selfHarm: false,
            otherInjury: false,
            loudVoice: false,
            pica: false,
            other: false,
          },
          specialNotes: '特になし',
          behaviorTags: [],
        },
      ],
      userCount: 1,
    };

    await act(async () => {
      await result.current.onSave(payload);
    });

    expect(mocks.saveDailyRecordWithQualityReview).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyRepository: mocks.dailyRepository,
        input: payload,
        createdAt: expect.any(String),
      }),
    );
    expect(mocks.dailyRepository.save).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/today', { replace: true });
    expect(result.current.open).toBe(false);
  });

  it('shows toast error on save failure', async () => {
    mocks.saveDailyRecordWithQualityReview.mockRejectedValueOnce(new Error('Save failed'));
    const { result } = renderHook(() => useTableDailyRecordViewModel());

    await suppressConsoleDuring('error', async () => {
      await expect(
        act(async () => {
          await result.current.onSave({
            date: '2026-02-07',
            reporter: { name: 'テスト担当者', role: '生活支援員' },
            userRows: [],
            userCount: 0,
          });
        }),
      ).rejects.toThrow('Save failed');
    }, /日報保存に失敗しました/);

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      '保存に失敗しました。もう一度お試しください。',
      { duration: 5000 },
    );
    expect(result.current.open).toBe(true);
  });
});
