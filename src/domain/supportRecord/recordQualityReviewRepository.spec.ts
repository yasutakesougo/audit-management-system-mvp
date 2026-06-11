import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import {
  InMemoryRecordQualityReviewRepository,
  type RecordQualityReviewRepository,
} from './recordQualityReviewRepository';
import { buildRecordQualityHumanReviewQueue } from './recordQualityHumanReviewQueue';

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
      const saved = await repository.saveReview(createDraft('record-draft'));

      expect(saved.status).toBe('draft');

      const accepted = acceptRecordQualityReviewDraft(saved, '2026-06-11T01:00:00.000Z');
      await expect(repository.updateReview(accepted)).resolves.toMatchObject({
        status: 'accepted',
        sourceOfTruth: 'original_record',
        outputKind: 'review_metadata',
        requiresHumanReview: true,
      });

      const savedForRevision = await repository.saveReview(createDraft('record-revised'));
      const revised = reviseRecordQualityReviewDraft(savedForRevision, {
        notes: ['確認観点を修正する'],
        updatedAt: '2026-06-11T02:00:00.000Z',
      });
      await expect(repository.updateReview(revised)).resolves.toMatchObject({
        status: 'revised',
        sourceOfTruth: 'original_record',
        outputKind: 'review_metadata',
        requiresHumanReview: true,
      });

      const savedForDiscard = await repository.saveReview(createDraft('record-discarded'));
      const discarded = discardRecordQualityReviewDraft(
        savedForDiscard,
        '2026-06-11T03:00:00.000Z',
      );
      await expect(repository.updateReview(discarded)).resolves.toMatchObject({
        status: 'discarded',
        sourceOfTruth: 'original_record',
        outputKind: 'review_metadata',
        requiresHumanReview: true,
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

    it('keeps accept, revise, and discard transitions separate from the original support record', async () => {
      const repository = factory();
      const originalSupportRecord = {
        id: 'record-1',
        body: '元の支援記録本文',
        content: '水分補給を促し、本人の反応を観察した',
        updatedAt: '2026-06-10T23:00:00.000Z',
      };
      const originalSnapshot = structuredClone(originalSupportRecord);

      const saved = await repository.saveReview(createDraft(originalSupportRecord.id));
      const accepted = await repository.updateReview(
        acceptRecordQualityReviewDraft(saved, '2026-06-11T01:00:00.000Z'),
      );
      const savedForRevision = await repository.saveReview(createDraft('record-2'));
      const revised = await repository.updateReview(
        reviseRecordQualityReviewDraft(savedForRevision, {
          notes: ['本文ではなくレビュー観点だけを修正する'],
          updatedAt: '2026-06-11T02:00:00.000Z',
        }),
      );
      const savedForDiscard = await repository.saveReview(createDraft('record-3'));
      const discarded = await repository.updateReview(
        discardRecordQualityReviewDraft(savedForDiscard, '2026-06-11T03:00:00.000Z'),
      );

      expect(originalSupportRecord).toEqual(originalSnapshot);
      expect(accepted.originalRecord).toEqual({ recordId: originalSupportRecord.id });
      expect(revised.originalRecord).toEqual({ recordId: 'record-2' });
      expect(discarded.originalRecord).toEqual({ recordId: 'record-3' });
      expect('body' in discarded).toBe(false);
      expect('content' in discarded).toBe(false);
      expect(discarded.sourceOfTruth).toBe('original_record');
      expect(discarded.outputKind).toBe('review_metadata');
      expect(discarded.requiresHumanReview).toBe(true);
    });

    it('supports building an active human review queue from stored review metadata only', async () => {
      const repository = factory();
      const oldestDraft = await repository.saveReview(
        createDraft('record-oldest-draft'),
      );
      const newerDraft = await repository.saveReview({
        ...createDraft('record-newer-draft'),
        createdAt: '2026-06-11T01:00:00.000Z',
        updatedAt: '2026-06-11T01:00:00.000Z',
      });
      const accepted = await repository.saveReview({
        ...createDraft('record-accepted'),
        createdAt: '2026-06-11T02:00:00.000Z',
        updatedAt: '2026-06-11T02:00:00.000Z',
      });
      const revised = await repository.saveReview({
        ...createDraft('record-revised'),
        createdAt: '2026-06-11T03:00:00.000Z',
        updatedAt: '2026-06-11T03:00:00.000Z',
      });
      const discarded = await repository.saveReview({
        ...createDraft('record-discarded'),
        createdAt: '2026-06-11T04:00:00.000Z',
        updatedAt: '2026-06-11T04:00:00.000Z',
      });

      await repository.updateReview(
        acceptRecordQualityReviewDraft(accepted, '2026-06-11T05:00:00.000Z'),
      );
      await repository.updateReview(
        reviseRecordQualityReviewDraft(revised, {
          notes: ['人間レビューキューで再確認する'],
          updatedAt: '2026-06-11T06:00:00.000Z',
        }),
      );
      await repository.updateReview(
        discardRecordQualityReviewDraft(discarded, '2026-06-11T07:00:00.000Z'),
      );

      const storedReviews = await repository.listReviews();
      const queue = buildRecordQualityHumanReviewQueue(storedReviews);

      expect(queue.totalCount).toBe(3);
      expect(queue.oldestUpdatedAt).toBe(oldestDraft.updatedAt);
      expect(queue.items.map(item => item.recordId)).toEqual([
        oldestDraft.recordId,
        newerDraft.recordId,
        revised.recordId,
      ]);
      expect(queue.items.map(item => item.status)).toEqual(['draft', 'draft', 'revised']);
      expect(queue.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceOfTruth: 'original_record',
            outputKind: 'review_metadata',
            requiresHumanReview: true,
          }),
        ]),
      );
      expect(queue.items.map(item => item.recordId)).not.toContain(accepted.recordId);
      expect(queue.items.map(item => item.recordId)).not.toContain(discarded.recordId);
      expect(queue.items.some(item => 'body' in item)).toBe(false);
      expect(queue.items.some(item => 'content' in item)).toBe(false);
      expect(queue.items.some(item => 'originalText' in item)).toBe(false);
    });
  });
};

runRecordQualityReviewRepositoryContract(
  'InMemoryRecordQualityReviewRepository contract',
  createRepository,
);
