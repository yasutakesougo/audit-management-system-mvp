import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { RecordQualityHumanReviewQueueRepository } from '@/domain/supportRecord/recordQualityHumanReviewQueue';
import { useRecordQualityHumanReviewQueue } from '../hooks/useRecordQualityHumanReviewQueue';

type HumanReviewQueueSummaryProps = {
  readonly repository: RecordQualityHumanReviewQueueRepository;
  readonly maxItems?: number;
};

export function HumanReviewQueueSummary({
  repository,
  maxItems = 5,
}: HumanReviewQueueSummaryProps) {
  const { queue, isLoading, error } = useRecordQualityHumanReviewQueue(repository);
  const visibleItems = queue.items.slice(0, maxItems);
  const draftCount = queue.items.filter(item => item.status === 'draft').length;
  const revisedCount = queue.items.filter(item => item.status === 'revised').length;

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1 }}
      data-testid="record-quality-human-review-summary"
    >
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" component="h2">
              記録品質レビュー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              要確認のレビュー状況
            </Typography>
          </Box>

          {isLoading && (
            <Typography role="status" variant="body2" color="text.secondary">
              要人間レビューを読み込み中
            </Typography>
          )}

          {!isLoading && error && (
            <Alert severity="error" data-testid="record-quality-human-review-error">
              要人間レビューを読み込めませんでした
            </Alert>
          )}

          {!isLoading && !error && queue.totalCount === 0 && (
            <Alert severity="success" data-testid="record-quality-human-review-empty">
              要人間レビューはありません
            </Alert>
          )}

          {!isLoading && !error && queue.totalCount > 0 && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  label={`要確認 ${queue.totalCount}件`}
                  color="warning"
                  size="small"
                  data-testid="record-quality-human-review-count"
                />
                <Chip
                  label={`未確認 ${draftCount}件`}
                  size="small"
                  variant="outlined"
                  data-testid="record-quality-human-review-draft-count"
                />
                <Chip
                  label={`修正済み ${revisedCount}件`}
                  size="small"
                  variant="outlined"
                  data-testid="record-quality-human-review-revised-count"
                />
                {queue.oldestUpdatedAt && (
                  <Typography variant="caption" color="text.secondary">
                    最古更新 {queue.oldestUpdatedAt}
                  </Typography>
                )}
              </Stack>

              <List dense disablePadding data-testid="record-quality-human-review-list">
                {visibleItems.map(item => (
                  <ListItem
                    key={item.recordId}
                    disableGutters
                    divider
                    data-testid={`record-quality-human-review-item-${item.recordId}`}
                  >
                    <Stack spacing={0.5} sx={{ width: '100%' }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.sourceRecordId}
                        </Typography>
                        <Chip label={item.label} size="small" variant="outlined" />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        候補 {item.suggestedCategoryCount}件 / 不足情報{' '}
                        {item.missingInformationHintCount}件 / ノート {item.noteCount}件
                      </Typography>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
