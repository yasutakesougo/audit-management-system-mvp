import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {
  RecordQualityHumanReviewQueueRepository,
  RecordQualityReviewRepository,
} from '../../application/recordQualityHumanReviewContracts';
import { HumanReviewWorkflowSummary } from '../components/HumanReviewWorkflowSummary';

export type RecordQualityHumanReviewPageProps = {
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly queueRepository: RecordQualityHumanReviewQueueRepository;
};

export default function RecordQualityHumanReviewPage(
  repositories: RecordQualityHumanReviewPageProps,
) {

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
