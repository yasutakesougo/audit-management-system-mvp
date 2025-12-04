import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { TESTIDS } from '@/testids';

export type ScheduleEmptyHintProps = {
  view: 'day' | 'week' | 'month';
  periodLabel?: string;
  sx?: SxProps<Theme>;
};

const resolvePrefix = (view: ScheduleEmptyHintProps['view'], periodLabel?: string): string => {
  if (periodLabel) {
    return `${periodLabel}の予定はまだ登録されていません。`;
  }
  switch (view) {
    case 'day':
      return 'この日の予定はまだ登録されていません。';
    case 'week':
      return 'この週の予定はまだ登録されていません。';
    case 'month':
      return 'この月の予定はまだ登録されていません。';
    default:
      return '予定はまだ登録されていません。';
  }
};

const resolveBody = (view: ScheduleEmptyHintProps['view'], prefix: string): string => {
  switch (view) {
    case 'day':
      return `${prefix} 右下の「＋」か画面上部の「新規作成」から予定を追加できます。`;
    case 'week':
      return `${prefix} 必要に応じて日表示に切り替えて、予定を追加してください。`;
    case 'month':
      return `${prefix} カレンダーの日付を選んで日表示に移動し、予定を追加できます。`;
    default:
      return prefix;
  }
};

export function ScheduleEmptyHint({ view, periodLabel, sx }: ScheduleEmptyHintProps) {
  const prefix = resolvePrefix(view, periodLabel);
  const message = resolveBody(view, prefix);

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid={TESTIDS.SCHEDULES_EMPTY_HINT}
      sx={{ mb: 1.5, ...sx }}
    >
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

export default ScheduleEmptyHint;
