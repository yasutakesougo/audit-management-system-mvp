import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import {
  InMemoryRecordQualityReviewRepository,
  type RecordQualityReviewRepository,
} from './recordQualityReviewRepository';

const timestamp = '2026-06-11T00:00:00.000Z';

const createRepository = (): RecordQualityReviewRepository =>
  new InMemoryRecordQualityReviewRepository();

const createDraft = (recordId = 'record-1'): RecordQualityReviewDraft =>
  createRecordQualityReviewDraft({
    recordId,
    suggestedCategories: [
      {
        categoryId: 'mealsHydration',
        matchedSignals: ['昼食', '水分'],
        source: 'rule',
      },
    ],
    missingInformationHints: [
      {
        code: 'staffSupportAction',
        label: '職員の支援内容',
        source: 'rule',
      },
    ],
    notes: ['人間レビューで確認する'],
    createdAt: timestamp,
  });

const runRecordQualityReviewRepositoryContract = (
  name: string,
  factory: () => RecordQualityReviewRepository,
): void => {
  describe(name, () => {
    it('saves, retrieves, and lists review drafts by original record id', async () => {
      const repository = factory();
      const draft = createDraft();

      const saved = await repository.saveReview(draft);

      expect(await repository.getReview('record-1')).toEqual(saved);
      expect(await repository.getReview('unknown-record')).toBeNull();
      expect(await repository.listReviews()).toEqual([saved]);
      expect(saved.originalRecord).toEqual({ recordId: 'record-1' });
    });

    it('updates an existing review without changing the source-of-truth reference', async () => {
      const repository = factory();
      const draft = await repository.saveReview(createDraft());
      const accepted = acceptRecordQualityReviewDraft(draft, '2026-06-11T01:00:00.000Z');

      const updated = await repository.updateReview(accepted);

      expect(updated.status).toBe('accepted');
      expect(updated.recordId).toBe('record-1');
      expect(updated.originalRecord).toEqual({ recordId: 'record-1' });
      expect(updated.sourceOfTruth).toBe('original_record');
      expect(updated.outputKind).toBe('review_metadata');
      expect(updated.requiresHumanReview).toBe(true);
    });

    it('does not expose mutable internal state', async () => {
      const repository = factory();
      const saved = await repository.saveReview(createDraft());
      saved.notes.push('tampered');
      saved.suggestedCategories[0].matchedSignals.push('tampered');

      const stored = await repository.getReview('record-1');

      expect(stored?.notes).toEqual(['人間レビューで確認する']);
      expect(stored?.suggestedCategories[0].matchedSignals).toEqual(['昼食', '水分']);
    });

    it('stores review metadata only and never copies original record text', async () => {
      const repository = factory();
      const draftWithText = {
        ...createDraft(),
        originalText: '元の支援記録本文はrepositoryに保存しない',
      } as RecordQualityReviewDraft & { originalText: string };

      const saved = await repository.saveReview(draftWithText);

      expect('originalText' in saved).toBe(false);
      expect(saved.originalRecord).toEqual({ recordId: 'record-1' });
      expect(saved.prohibitedActions).toEqual([
        'diagnose_users',
        'judge_behavior',
        'determine_support_policy',
        'overwrite_original_record',
      ]);
    });

    it('keeps statuses limited to draft, accepted, revised, and discarded', async () => {
      const repository = factory();
      await repository.saveReview(createDraft());

      const revised = reviseRecordQualityReviewDraft(createDraft(), {
        notes: ['確認観点を修正する'],
        updatedAt: '2026-06-11T02:00:00.000Z',
      });
      await expect(repository.updateReview(revised)).resolves.toMatchObject({
        status: 'revised',
      });

      const invalid = {
        ...createDraft(),
        status: 'diagnosed',
      } as unknown as RecordQualityReviewDraft;

      await expect(repository.saveReview(invalid)).rejects.toThrow(
        'Unsupported record quality review status',
      );
    });

    it('rejects duplicate saves and updates to missing reviews', async () => {
      const repository = factory();
      const draft = createDraft();

      await repository.saveReview(draft);

      await expect(repository.saveReview(draft)).rejects.toThrow(
        'Record quality review already exists',
      );
      await expect(repository.updateReview(createDraft('record-2'))).rejects.toThrow(
        'Record quality review not found',
      );
    });
  });
};

runRecordQualityReviewRepositoryContract(
  'InMemoryRecordQualityReviewRepository contract',
  createRepository,
);
