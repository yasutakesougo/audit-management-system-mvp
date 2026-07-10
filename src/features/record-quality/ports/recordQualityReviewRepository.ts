import type { RecordQualityReviewDraft } from '../domain/recordQualityReview';

export type RecordQualityReviewRecordId = string;

export interface RecordQualityReviewRepository {
  saveReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft>;
  getReview(recordId: RecordQualityReviewRecordId): Promise<RecordQualityReviewDraft | null>;
  updateReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft>;
  listReviews(): Promise<RecordQualityReviewDraft[]>;
}
