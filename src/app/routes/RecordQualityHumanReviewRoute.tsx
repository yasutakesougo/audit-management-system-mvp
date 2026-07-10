import { useMemo } from 'react';

import {
  DataProviderRecordQualityReviewPersistenceStore,
  InMemoryRecordQualityHumanReviewQueueRepository,
  RecordQualityHumanReviewPage,
  RecordQualityReviewPersistenceRepository,
} from '@/features/record-quality';
import { useDataProvider } from '@/lib/data/useDataProvider';

export default function RecordQualityHumanReviewRoute() {
  const { provider } = useDataProvider();
  const repositories = useMemo(() => {
    const reviewRepository = new RecordQualityReviewPersistenceRepository(
      new DataProviderRecordQualityReviewPersistenceStore({ provider }),
    );
    const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
      reviewRepository,
    );
    return { reviewRepository, queueRepository };
  }, [provider]);

  return <RecordQualityHumanReviewPage {...repositories} />;
}
