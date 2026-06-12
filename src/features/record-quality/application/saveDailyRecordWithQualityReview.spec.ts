import { describe, expect, it, vi } from 'vitest';

import type {
  DailyRecordRepository,
  SaveDailyRecordInput,
} from '@/features/daily/domain/DailyRecordRepository';
import { InMemoryRecordQualityReviewRepository } from '@/domain/supportRecord/recordQualityReviewRepository';
import {
  saveDailyRecordWithQualityReview,
} from './saveDailyRecordWithQualityReview';

describe('saveDailyRecordWithQualityReview', () => {
  it('saves the daily record and creates review metadata for each support row', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = new InMemoryRecordQualityReviewRepository();

    const result = await saveDailyRecordWithQualityReview({
      dailyRepository,
      reviewRepository,
      input: createDailyRecordInput(),
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(dailyRepository.save).toHaveBeenCalledWith(createDailyRecordInput(), undefined);
    expect(result).toEqual({
      savedDailyRecord: true,
      createdReviewCount: 2,
      skippedReviewCount: 0,
    });
    await expect(
      reviewRepository.getReview('daily:2026-06-12:user-1'),
    ).resolves.toMatchObject({
      recordId: 'daily:2026-06-12:user-1',
      originalRecord: { recordId: 'daily:2026-06-12:user-1' },
      status: 'draft',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
      createdAt: '2026-06-12T09:00:00.000Z',
    });
    await expect(
      reviewRepository.getReview('daily:2026-06-12:user-2'),
    ).resolves.toMatchObject({
      recordId: 'daily:2026-06-12:user-2',
      originalRecord: { recordId: 'daily:2026-06-12:user-2' },
    });
  });

  it('does not persist original support row text in the review metadata', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = new InMemoryRecordQualityReviewRepository();

    await saveDailyRecordWithQualityReview({
      dailyRepository,
      reviewRepository,
      input: createDailyRecordInput({
        specialNotes: '元の支援記録本文。職員が声かけを行った。',
      }),
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    const review = await reviewRepository.getReview('daily:2026-06-12:user-1');
    expect(JSON.stringify(review)).not.toContain('元の支援記録本文');
    expect(review && 'originalText' in review).toBe(false);
    expect(review?.originalRecord).toEqual({ recordId: 'daily:2026-06-12:user-1' });
  });

  it('skips rows with no reviewable support text', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = new InMemoryRecordQualityReviewRepository();

    const result = await saveDailyRecordWithQualityReview({
      dailyRepository,
      reviewRepository,
      input: {
        ...createDailyRecordInput(),
        userRows: [
          {
            userId: 'empty-user',
            userName: '空欄 利用者',
            amActivity: '',
            pmActivity: '',
            lunchAmount: '',
            specialNotes: '',
            problemBehavior: {
              selfHarm: false,
              otherInjury: false,
              loudVoice: false,
              pica: false,
              other: false,
            },
            behaviorTags: [],
          },
        ],
        userCount: 1,
      },
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(result.createdReviewCount).toBe(0);
    expect(result.skippedReviewCount).toBe(1);
    await expect(
      reviewRepository.getReview('daily:2026-06-12:empty-user'),
    ).resolves.toBeNull();
  });

  it('skips existing review metadata without failing the daily save', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = new InMemoryRecordQualityReviewRepository();
    const input = createDailyRecordInput();

    await saveDailyRecordWithQualityReview({
      dailyRepository,
      reviewRepository,
      input,
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    const result = await saveDailyRecordWithQualityReview({
      dailyRepository,
      reviewRepository,
      input,
      createdAt: '2026-06-12T10:00:00.000Z',
    });

    expect(dailyRepository.save).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      savedDailyRecord: true,
      createdReviewCount: 0,
      skippedReviewCount: 2,
    });
  });

  it('passes mutation params to the daily repository save boundary', async () => {
    const dailyRepository = createDailyRepository();
    const reviewRepository = new InMemoryRecordQualityReviewRepository();
    const abortController = new AbortController();

    await saveDailyRecordWithQualityReview({
      dailyRepository,
      reviewRepository,
      input: createDailyRecordInput(),
      mutationParams: { signal: abortController.signal },
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(dailyRepository.save).toHaveBeenCalledWith(
      createDailyRecordInput(),
      { signal: abortController.signal },
    );
  });
});

function createDailyRepository(): DailyRecordRepository {
  return {
    save: vi.fn(async () => undefined),
    load: vi.fn(),
    list: vi.fn(),
    approve: vi.fn(),
    scanIntegrity: vi.fn(),
  };
}

function createDailyRecordInput(
  overrides: { readonly specialNotes?: string } = {},
): SaveDailyRecordInput {
  return {
    date: '2026-06-12',
    reporter: {
      name: '記録者',
      role: '生活支援員',
    },
    userRows: [
      {
        userId: 'user-1',
        userName: '利用者 一',
        amActivity: '午前は作業室で軽作業に参加した。',
        pmActivity: '午後は職員が声かけを行い、休憩を提案した。',
        lunchAmount: '昼食は8割、水分はコップ半分程度。',
        specialNotes: overrides.specialNotes ?? '',
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        behaviorTags: [],
      },
      {
        userId: 'user-2',
        userName: '利用者 二',
        amActivity: '午前は音楽活動に参加した。',
        pmActivity: '',
        lunchAmount: '昼食は完食。',
        specialNotes: '次回も活動前に予定確認を行う。',
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        behaviorTags: [],
      },
    ],
    userCount: 2,
  };
}
