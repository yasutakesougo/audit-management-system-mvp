import {
  RecordQualityHumanReviewPage,
  useRecordQualityRuntime,
} from '@/features/record-quality';

export default function RecordQualityHumanReviewRoute() {
  const repositories = useRecordQualityRuntime();

  return <RecordQualityHumanReviewPage {...repositories} />;
}
