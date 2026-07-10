import { describe, expect, it, vi } from 'vitest';

import type {
  DailyRecordDomain,
  DailyRecordRepository,
  DailyRecordRepositoryMutationParams,
} from '@/features/daily';
import type { RecordQualityReviewRepository } from '@/features/record-quality';

import { createDailyRecordQualityReviewRepository } from './createDailyRecordQualityReviewRepository';

describe('createDailyRecordQualityReviewRepository', () => {
  it('normalizes userCount, preserves mutation params, and creates review metadata', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = createReviewRepository();
    const repository = createDailyRecordQualityReviewRepository({
      dailyRepository,
      reviewRepository,
      now: () => '2026-07-10T10:00:00.000Z',
    });
    const params: DailyRecordRepositoryMutationParams = {
      signal: new AbortController().signal,
    };

    await repository.save(createDailyRecord(), params);

    expect(dailyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userCount: 2 }),
      params,
    );
    expect(reviewRepository.saveReview).toHaveBeenCalledTimes(1);
    expect(reviewRepository.saveReview).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: 'daily:2026-07-10:user-1',
        originalRecord: { recordId: 'daily:2026-07-10:user-1' },
        createdAt: '2026-07-10T10:00:00.000Z',
      }),
    );
  });

  it('delegates non-save repository operations without changing their arguments', async () => {
    const dailyRepository = createDailyRepository();
    const repository = createDailyRecordQualityReviewRepository({
      dailyRepository,
      reviewRepository: createReviewRepository(),
    });
    const signal = new AbortController().signal;
    const range = { startDate: '2026-07-01', endDate: '2026-07-10' };
    const approval = {
      date: '2026-07-10',
      approverName: 'Reviewer',
      approverRole: 'Manager',
    };

    await repository.load('2026-07-10');
    await repository.list({ range, signal });
    await repository.approve(approval, { signal });
    await repository.scanIntegrity(['2026-07-10'], signal);

    expect(dailyRepository.load).toHaveBeenCalledWith('2026-07-10');
    expect(dailyRepository.list).toHaveBeenCalledWith({ range, signal });
    expect(dailyRepository.approve).toHaveBeenCalledWith(approval, { signal });
    expect(dailyRepository.scanIntegrity).toHaveBeenCalledWith(['2026-07-10'], signal);
  });

  it('propagates a review creation failure after the daily record is saved', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = createReviewRepository();
    vi.mocked(reviewRepository.saveReview).mockRejectedValueOnce(new Error('review failed'));
    const repository = createDailyRecordQualityReviewRepository({
      dailyRepository,
      reviewRepository,
    });

    await expect(repository.save(createDailyRecord())).rejects.toThrow('review failed');
    expect(dailyRepository.save).toHaveBeenCalledOnce();
  });
});

function createDailyRepository(): DailyRecordRepository {
  return {
    save: vi.fn(async () => undefined),
    load: vi.fn(async () => null),
    list: vi.fn(async () => []),
    approve: vi.fn(async () => createDailyRecord()),
    scanIntegrity: vi.fn(async () => []),
  };
}

function createReviewRepository(): RecordQualityReviewRepository {
  return {
    saveReview: vi.fn(async review => review),
    getReview: vi.fn(async () => null),
    updateReview: vi.fn(async review => review),
    listReviews: vi.fn(async () => []),
  };
}

function createDailyRecord(): DailyRecordDomain {
  return {
    date: '2026-07-10',
    reporter: { name: 'Reporter', role: 'Staff' },
    userCount: 0,
    userRows: [
      {
        userId: 'user-1',
        userName: 'User One',
        amActivity: '散歩',
        pmActivity: '',
        lunchAmount: '',
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: '',
        behaviorTags: [],
      },
      {
        userId: 'user-2',
        userName: 'User Two',
        amActivity: '',
        pmActivity: '',
        lunchAmount: '',
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: '',
        behaviorTags: [],
      },
    ],
  };
}
