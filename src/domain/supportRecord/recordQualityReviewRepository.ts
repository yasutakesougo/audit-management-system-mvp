import {
  RECORD_QUALITY_REVIEW_SAFETY_METADATA,
  RECORD_QUALITY_REVIEW_STATUSES,
  type RecordQualityReviewDraft,
  type RecordQualityReviewStatus,
} from './recordQualityReview';

export type RecordQualityReviewRecordId = string;

export interface RecordQualityReviewRepository {
  saveReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft>;
  getReview(recordId: RecordQualityReviewRecordId): Promise<RecordQualityReviewDraft | null>;
  updateReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft>;
  listReviews(): Promise<RecordQualityReviewDraft[]>;
}

export class InMemoryRecordQualityReviewRepository
  implements RecordQualityReviewRepository
{
  private readonly reviews = new Map<RecordQualityReviewRecordId, RecordQualityReviewDraft>();

  constructor(seed: readonly RecordQualityReviewDraft[] = []) {
    for (const review of seed) {
      const sanitized = sanitizeRecordQualityReview(review);
      if (this.reviews.has(sanitized.recordId)) {
        throw new Error(`Record quality review already exists: ${sanitized.recordId}`);
      }
      this.reviews.set(sanitized.recordId, sanitized);
    }
  }

  async saveReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft> {
    const sanitized = sanitizeRecordQualityReview(review);
    if (this.reviews.has(sanitized.recordId)) {
      throw new Error(`Record quality review already exists: ${sanitized.recordId}`);
    }

    this.reviews.set(sanitized.recordId, sanitized);
    return clone(sanitized);
  }

  async getReview(
    recordId: RecordQualityReviewRecordId,
  ): Promise<RecordQualityReviewDraft | null> {
    const review = this.reviews.get(recordId);
    return review ? clone(review) : null;
  }

  async updateReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft> {
    const sanitized = sanitizeRecordQualityReview(review);
    if (!this.reviews.has(sanitized.recordId)) {
      throw new Error(`Record quality review not found: ${sanitized.recordId}`);
    }

    this.reviews.set(sanitized.recordId, sanitized);
    return clone(sanitized);
  }

  async listReviews(): Promise<RecordQualityReviewDraft[]> {
    return [...this.reviews.values()].map(clone);
  }
}

function sanitizeRecordQualityReview(review: RecordQualityReviewDraft): RecordQualityReviewDraft {
  return {
    ...RECORD_QUALITY_REVIEW_SAFETY_METADATA,
    recordId: review.recordId,
    originalRecord: {
      recordId: review.recordId,
    },
    status: assertRecordQualityReviewStatus(review.status),
    suggestedCategories: review.suggestedCategories.map(category => ({
      categoryId: category.categoryId,
      matchedSignals: [...category.matchedSignals],
      source: category.source,
    })),
    missingInformationHints: review.missingInformationHints.map(hint => ({
      code: hint.code,
      label: hint.label,
      source: hint.source,
    })),
    notes: [...review.notes],
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function assertRecordQualityReviewStatus(status: string): RecordQualityReviewStatus {
  if (!(RECORD_QUALITY_REVIEW_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Unsupported record quality review status: ${status}`);
  }

  return status as RecordQualityReviewStatus;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
