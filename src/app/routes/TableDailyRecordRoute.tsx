import { useMemo } from 'react';

import {
  TableDailyRecordPage,
  useDailyRecordRepository,
} from '@/features/daily';
import { useRecordQualityRuntime } from '@/features/record-quality';

import { createDailyRecordQualityReviewRepository } from '../services/createDailyRecordQualityReviewRepository';

export default function TableDailyRecordRoute() {
  const dailyRepository = useDailyRecordRepository();
  const { reviewRepository } = useRecordQualityRuntime();
  const repository = useMemo(
    () =>
      createDailyRecordQualityReviewRepository({
        dailyRepository,
        reviewRepository,
      }),
    [dailyRepository, reviewRepository],
  );

  return <TableDailyRecordPage repository={repository} />;
}
