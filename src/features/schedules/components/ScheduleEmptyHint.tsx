import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { TESTIDS } from '@/testids';
import { scheduleFacilityEmptyCopy } from '@/features/schedules/domain/categoryLabels';

export type ScheduleEmptyHintProps = {
  view: 'day' | 'week' | 'month';
  periodLabel?: string;
  sx?: SxProps<Theme>;
  compact?: boolean;
};

export function ScheduleEmptyHint(props: ScheduleEmptyHintProps) {
  const { title, description, cta } = scheduleFacilityEmptyCopy;
  const { sx, compact = false } = props;

  // Compact mode: single-line hint only (no multi-paragraph explanation)
  if (compact) {
    return (
      <Box
        role="status"
        aria-live="polite"
        data-testid={TESTIDS.SCHEDULES_EMPTY_HINT}
        sx={{ mb: 0.5, ...sx }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
          予定はまだありません（＋から追加）
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid={TESTIDS.SCHEDULES_EMPTY_HINT}
      sx={{ mb: 1.5, display: 'grid', gap: 0.5, ...sx }}
    >
      <Typography variant="subtitle2" color="text.primary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {cta}
      </Typography>
    </Box>
  );
}

export default ScheduleEmptyHint;
