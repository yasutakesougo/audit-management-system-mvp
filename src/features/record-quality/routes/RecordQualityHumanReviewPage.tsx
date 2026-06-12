import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import {
  InMemoryRecordQualityHumanReviewQueueRepository,
} from '@/domain/supportRecord/recordQualityHumanReviewQueue';
import {
  createRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from '@/domain/supportRecord/recordQualityReview';
import {
  InMemoryRecordQualityReviewRepository,
} from '@/domain/supportRecord/recordQualityReviewRepository';
import { HumanReviewWorkflowSummary } from '../components/HumanReviewWorkflowSummary';

function createReview(recordId: string, createdAt: string): RecordQualityReviewDraft {
  return createRecordQualityReviewDraft({
    recordId,
    suggestedCategories: [
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '声かけ'],
        source: 'rule',
      },
    ],
    missingInformationHints: [
      {
        code: 'userResponseAfterSupport',
        label: '支援後の本人の反応',
        source: 'rule',
      },
    ],
    notes: ['人間レビューで確認する'],
    createdAt,
  });
}

function createInitialReviews(): RecordQualityReviewDraft[] {
  return [
    createReview('support-record-review-1', '2026-06-11T00:00:00.000Z'),
    reviseRecordQualityReviewDraft(
      createReview('support-record-review-2', '2026-06-11T01:00:00.000Z'),
      {
        notes: ['確認観点を修正済み'],
        updatedAt: '2026-06-11T02:00:00.000Z',
      },
    ),
  ];
}

export default function RecordQualityHumanReviewPage() {
  const repositories = useMemo(() => {
    const reviewRepository = new InMemoryRecordQualityReviewRepository(
      createInitialReviews(),
    );
    const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
      reviewRepository,
    );

    return { reviewRepository, queueRepository };
  }, []);

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
