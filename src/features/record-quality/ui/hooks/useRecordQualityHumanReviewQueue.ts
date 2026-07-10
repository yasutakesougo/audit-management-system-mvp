import { useCallback, useEffect, useState } from 'react';

import {
  emptyRecordQualityHumanReviewQueueSummary,
  type RecordQualityHumanReviewQueue,
  type RecordQualityHumanReviewQueueRepository,
} from '@/features/record-quality/application/recordQualityHumanReviewContracts';
import { listRecordQualityHumanReviewQueue } from '@/features/record-quality/application/recordQualityHumanReviewQueueUseCase';

const emptyQueue: RecordQualityHumanReviewQueue = {
  items: [],
  totalCount: 0,
  oldestUpdatedAt: undefined,
  summary: emptyRecordQualityHumanReviewQueueSummary,
};

export type UseRecordQualityHumanReviewQueueResult = {
  readonly queue: RecordQualityHumanReviewQueue;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly reload: () => Promise<void>;
};

export function useRecordQualityHumanReviewQueue(
  repository: RecordQualityHumanReviewQueueRepository,
): UseRecordQualityHumanReviewQueueResult {
  const [queue, setQueue] = useState<RecordQualityHumanReviewQueue>(emptyQueue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setQueue(await listRecordQualityHumanReviewQueue({ repository }));
    } catch (caught) {
      setQueue(emptyQueue);
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    queue,
    isLoading,
    error,
    reload,
  };
}
