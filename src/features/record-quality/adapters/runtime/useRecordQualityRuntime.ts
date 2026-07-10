import { useMemo } from 'react';

import { useDataProvider } from '@/lib/data/useDataProvider';

import { InMemoryRecordQualityHumanReviewQueueRepository } from '../in-memory/inMemoryRecordQualityHumanReviewQueueRepository';
import { DataProviderRecordQualityReviewPersistenceStore } from '../sharepoint/dataProviderRecordQualityReviewPersistenceStore';
import { RecordQualityReviewPersistenceRepository } from '../sharepoint/recordQualityReviewPersistenceRepository';
import type { RecordQualityHumanReviewQueueRepository } from '../../ports/recordQualityHumanReviewQueueRepository';
import type { RecordQualityReviewRepository } from '../../ports/recordQualityReviewRepository';

export type RecordQualityRuntime = {
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly queueRepository: RecordQualityHumanReviewQueueRepository;
};

/**
 * Builds the module runtime while keeping concrete persistence adapters private.
 * The app composition root consumes only the public repository ports.
 */
export function useRecordQualityRuntime(): RecordQualityRuntime {
  const { provider } = useDataProvider();

  return useMemo(() => {
    const reviewRepository = new RecordQualityReviewPersistenceRepository(
      new DataProviderRecordQualityReviewPersistenceStore({ provider }),
    );
    const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
      reviewRepository,
    );

    return { reviewRepository, queueRepository };
  }, [provider]);
}
