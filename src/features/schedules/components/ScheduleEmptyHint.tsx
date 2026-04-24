import { scheduleFacilityEmptyCopy } from '@/features/schedules/domain/mappers/categoryLabels';
import type { ScheduleCategory } from '@/features/schedules/domain/types';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

export type ScheduleEmptyHintProps = {
  view: 'day' | 'week' | 'month';
  periodLabel?: string;
  sx?: SxProps<Theme>;
  compact?: boolean;
  categoryFilter?: 'All' | ScheduleCategory;
  /** CTA: 新規作成ボタンの onClick コールバック */
  onCreateClick?: () => void;
};

export function ScheduleEmptyHint(props: ScheduleEmptyHintProps) {
  const { categoryFilter, sx, compact, onCreateClick } = props;
  const isOrg = categoryFilter === 'Org';
  const { title } = isOrg ? scheduleFacilityEmptyCopy : { title: '予定はまだありません' };
  const emptyLine = title.endsWith('。') ? title : `${title}。`;

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="schedules-empty-hint"
      sx={{
        mb: compact ? 0.5 : 1,
        textAlign: 'center',
        py: compact ? 2 : 3,
        ...sx,
      }}
    >
      <Stack spacing={compact ? 1 : 1.5} alignItems="center">
        <CheckCircleOutlineIcon
          sx={{ fontSize: compact ? 28 : 36, color: 'success.light', opacity: 0.7 }}
        />
        <Typography
          variant={compact ? 'body2' : 'body1'}
          color="text.secondary"
          sx={{ fontSize: compact ? 12 : 14 }}
        >
          {emptyLine}
        </Typography>

        {onCreateClick && (
          <Button
            variant="outlined"
            size={compact ? 'small' : 'medium'}
            startIcon={<AddIcon />}
            onClick={onCreateClick}
            sx={{ mt: compact ? 0.5 : 1 }}
          >
            {isOrg ? '施設予定を追加' : '新しい予定を作成'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default ScheduleEmptyHint;
