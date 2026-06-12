import { describe, expect, it, vi } from 'vitest';

import type { RecordQualityReviewDraft } from './recordQualityReview';
import {
  InMemoryRecordQualityReviewRepository,
  type RecordQualityReviewRepository,
} from './recordQualityReviewRepository';
import {
  createRecordQualityReviewFromSupportRecord,
} from './recordQualityReviewCreationUseCase';

describe('createRecordQualityReviewFromSupportRecord', () => {
  it('classifies a support record and saves review metadata for human review', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();

    const saved = await createRecordQualityReviewFromSupportRecord({
      repository,
      recordId: 'support-record-1',
      text: '12:10から昼食。水分はコップ半分程度。職員が休憩を提案した。',
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(saved).toMatchObject({
      recordId: 'support-record-1',
      originalRecord: { recordId: 'support-record-1' },
      status: 'draft',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
      createdAt: '2026-06-12T09:00:00.000Z',
      updatedAt: '2026-06-12T09:00:00.000Z',
    });
    expect(saved.suggestedCategories.map(category => category.categoryId)).toEqual(
      expect.arrayContaining(['mealsHydration', 'staffSupportActions']),
    );
    expect(saved.missingInformationHints.map(hint => hint.code)).toContain(
      'userResponseAfterSupport',
    );
    await expect(repository.getReview('support-record-1')).resolves.toEqual(saved);
  });

  it('does not persist original support record text through the creation workflow', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();

    const saved = await createRecordQualityReviewFromSupportRecord({
      repository,
      recordId: 'support-record-with-text',
      text: '元の支援記録本文。職員が声かけを行った。',
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(JSON.stringify(saved)).not.toContain('元の支援記録本文');
    expect('originalText' in saved).toBe(false);
    expect(saved.originalRecord).toEqual({ recordId: 'support-record-with-text' });
  });

  it('supports ai-sourced review suggestions without changing safety metadata', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();

    const saved = await createRecordQualityReviewFromSupportRecord({
      repository,
      recordId: 'support-record-ai',
      text: '予定変更があり、職員が説明した。',
      source: 'ai',
      notes: ['AI候補は人間レビュー前提で扱う'],
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(saved.suggestedCategories.every(category => category.source === 'ai')).toBe(true);
    expect(saved.missingInformationHints.every(hint => hint.source === 'ai')).toBe(true);
    expect(saved.notes).toEqual(['AI候補は人間レビュー前提で扱う']);
    expect(saved.requiresHumanReview).toBe(true);
    expect(saved.prohibitedActions).toEqual([
      'diagnose_users',
      'judge_behavior',
      'determine_support_policy',
      'overwrite_original_record',
    ]);
  });

  it('delegates duplicate review protection to the repository', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();
    const input = {
      repository,
      recordId: 'support-record-duplicate',
      text: '職員が声かけを行った。',
      createdAt: '2026-06-12T09:00:00.000Z',
    };

    await createRecordQualityReviewFromSupportRecord(input);

    await expect(createRecordQualityReviewFromSupportRecord(input)).rejects.toThrow(
      'Record quality review already exists: support-record-duplicate',
    );
  });

  it('passes only projected metadata to the injected repository boundary', async () => {
    const repository: RecordQualityReviewRepository = {
      saveReview: vi.fn(async review => review),
      getReview: vi.fn(),
      updateReview: vi.fn(),
      listReviews: vi.fn(),
    };

    await createRecordQualityReviewFromSupportRecord({
      repository,
      recordId: 'support-record-boundary',
      text: '元の支援記録本文。職員が声かけを行った。',
      createdAt: '2026-06-12T09:00:00.000Z',
    });

    expect(repository.saveReview).toHaveBeenCalledTimes(1);
    const [review] = vi.mocked(repository.saveReview).mock.calls[0] as [
      RecordQualityReviewDraft,
    ];
    expect(JSON.stringify(review)).not.toContain('元の支援記録本文');
    expect('originalText' in review).toBe(false);
    expect(review.originalRecord).toEqual({ recordId: 'support-record-boundary' });
  });
});
