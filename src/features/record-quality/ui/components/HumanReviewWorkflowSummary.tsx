import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { RecordQualityHumanReviewQueueRepository } from '@/features/record-quality/application/recordQualityHumanReviewContracts';
import type { RecordQualityReviewRepository } from '@/features/record-quality/application/recordQualityHumanReviewContracts';
import { useRecordQualityHumanReviewWorkflow } from '../hooks/useRecordQualityHumanReviewWorkflow';

type HumanReviewWorkflowSummaryProps = {
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly queueRepository: RecordQualityHumanReviewQueueRepository;
  readonly maxItems?: number;
  readonly getUpdatedAt?: () => string;
};

export function HumanReviewWorkflowSummary({
  reviewRepository,
  queueRepository,
  maxItems = 5,
  getUpdatedAt = () => new Date().toISOString(),
}: HumanReviewWorkflowSummaryProps) {
  const {
    queue,
    isLoading,
    error,
    isDeciding,
    decisionError,
    accept,
    revise,
    discard,
  } = useRecordQualityHumanReviewWorkflow({ reviewRepository, queueRepository });
  const visibleItems = queue.items.slice(0, maxItems);

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1 }}
      data-testid="record-quality-human-review-workflow-summary"
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

          {!isLoading && decisionError && (
            <Alert severity="error" data-testid="record-quality-human-review-decision-error">
              レビュー判断を保存できませんでした
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
                    <Stack spacing={1} sx={{ width: '100%' }}>
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
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          type="button"
                          size="small"
                          variant="outlined"
                          color="success"
                          disableRipple
                          startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                          disabled={isDeciding}
                          onClick={() =>
                            void accept({
                              recordId: item.recordId,
                              updatedAt: getUpdatedAt(),
                            })
                          }
                        >
                          採用
                        </Button>
                        <Button
                          type="button"
                          size="small"
                          variant="outlined"
                          color="info"
                          disableRipple
                          startIcon={<EditNoteIcon fontSize="small" />}
                          disabled={isDeciding}
                          onClick={() =>
                            void revise({
                              recordId: item.recordId,
                              notes: ['人間レビューで確認観点を修正済み'],
                              updatedAt: getUpdatedAt(),
                            })
                          }
                        >
                          修正済み
                        </Button>
                        <Button
                          type="button"
                          size="small"
                          variant="outlined"
                          color="error"
                          disableRipple
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          disabled={isDeciding}
                          onClick={() =>
                            void discard({
                              recordId: item.recordId,
                              updatedAt: getUpdatedAt(),
                            })
                          }
                        >
                          破棄
                        </Button>
                      </Stack>
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
