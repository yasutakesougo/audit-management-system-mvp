import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import {
  DataProviderRecordQualityReviewPersistenceStore,
} from '@/domain/supportRecord/dataProviderRecordQualityReviewPersistenceStore';
import {
  InMemoryRecordQualityHumanReviewQueueRepository,
} from '@/domain/supportRecord/recordQualityHumanReviewQueue';
import {
  RecordQualityReviewPersistenceRepository,
} from '@/domain/supportRecord/recordQualityReviewPersistenceRepository';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { HumanReviewWorkflowSummary } from '../components/HumanReviewWorkflowSummary';

export default function RecordQualityHumanReviewPage() {
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

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="record-quality-human-review-page">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            記録品質レビュー
          </Typography>
          <Typography variant="body2" color="text.secondary">
            支援記録の確認待ちレビュー
          </Typography>
        </Box>

        <HumanReviewWorkflowSummary {...repositories} />
      </Stack>
    </Container>
  );
}
