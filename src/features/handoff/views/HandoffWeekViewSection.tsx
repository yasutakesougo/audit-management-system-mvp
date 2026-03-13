/**
 * HandoffWeekViewSection — 週ビューの薄いラッパー
 *
 * 週ビュー用 ViewModel (useHandoffWeekViewModel) の呼び出しと
 * 表示タイトルを管理し、既存の HandoffWeekView に委譲する。
 */
import { Box, Typography } from '@mui/material';
import { HandoffWeekView } from '../components/HandoffWeekView';
import { useHandoffWeekViewModel } from '../hooks/useHandoffWeekViewModel';

export type HandoffWeekViewSectionProps = {
  /** 基準日 (YYYY-MM-DD) */
  date: string;
  /** 表示用日付ラベル */
  dateLabel: string;
  /** 日カードクリック時に day ビューへ遷移する */
  onDayClick: (date: string) => void;
};

export function HandoffWeekViewSection({
  date,
  dateLabel,
  onDayClick,
}: HandoffWeekViewSectionProps) {
  const weekVM = useHandoffWeekViewModel(date);

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
        {dateLabel}の申し送り
      </Typography>
      <HandoffWeekView
        summary={weekVM.summary}
        loading={weekVM.loading}
        error={weekVM.error}
        onDayClick={onDayClick}
      />
    </Box>
  );
}
