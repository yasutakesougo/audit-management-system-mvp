import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { TESTIDS } from '@/testids';
import { scheduleFacilityEmptyCopy } from '@/features/schedules/domain/categoryLabels';
import type { ScheduleCategory } from '@/features/schedules/domain/types';

export type ScheduleEmptyHintProps = {
  view: 'day' | 'week' | 'month';
  periodLabel?: string;
  sx?: SxProps<Theme>;
  compact?: boolean;
  categoryFilter?: 'All' | ScheduleCategory;
};

export function ScheduleEmptyHint(props: ScheduleEmptyHintProps) {
  const { title } = props.categoryFilter === 'Org' ? scheduleFacilityEmptyCopy : { title: '予定はまだありません' };
  const { sx, compact } = props;
  const emptyLine = title.endsWith('。') ? title : `${title}。`;

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid={TESTIDS.SCHEDULES_EMPTY_HINT}
      sx={{ mb: compact ? 0.5 : 1, ...sx }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: compact ? 12 : 13 }}>
        {emptyLine}
      </Typography>
    </Box>
  );
}

export default ScheduleEmptyHint;
